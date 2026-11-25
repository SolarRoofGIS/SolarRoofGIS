const { ASSUMPTIONS, DEFAULT_PANEL, round } = require("./solar");

// Household connections (R-1 to R-3 TR) with the PLN tariff each pays, unchanged for Q4 2026.
// Update the tariffs when PLN announces new ones each quarter.
const POWER_OPTIONS = [
  { id: "450", va: 450, label: "450 VA (subsidi)", tariffRpPerKwh: 415 },
  { id: "900s", va: 900, label: "900 VA (subsidi)", tariffRpPerKwh: 605 },
  { id: "900", va: 900, label: "900 VA (tanpa subsidi)", tariffRpPerKwh: 1352 },
  { id: "1300", va: 1300, label: "1.300 VA", tariffRpPerKwh: 1444.7 },
  { id: "2200", va: 2200, label: "2.200 VA", tariffRpPerKwh: 1444.7 },
  { id: "3500", va: 3500, label: "3.500 VA", tariffRpPerKwh: 1699.53 },
  { id: "4400", va: 4400, label: "4.400 VA", tariffRpPerKwh: 1699.53 },
  { id: "5500", va: 5500, label: "5.500 VA", tariffRpPerKwh: 1699.53 },
  { id: "6600", va: 6600, label: "6.600 VA", tariffRpPerKwh: 1699.53 },
  { id: "7700", va: 7700, label: "7.700 VA", tariffRpPerKwh: 1699.53 },
  { id: "11000", va: 11000, label: "11.000 VA", tariffRpPerKwh: 1699.53 },
  { id: "13200", va: 13200, label: "13.200 VA", tariffRpPerKwh: 1699.53 },
  { id: "16500", va: 16500, label: "16.500 VA", tariffRpPerKwh: 1699.53 },
];
const HOURS_PER_MONTH = 24 * 30;

// Planning-level financial assumptions, adjust here; the API and the panel follow.
const FINANCE = {
  // Installed cost of a rooftop system, split into hardware and the rest.
  costRpPerKwp: 15000000,
  panelsInverterShare: 0.85,
  bosInstallationShare: 0.15,
  // A common household connection and a monthly spending that fits it.
  defaultPower: "1300",
  defaultMonthlyBillRp: 500000,
  powerOptions: POWER_OPTIONS,
  // The usual performance warranty of a panel, and the length of the cost projection.
  projectionYears: 25,
  // Same module size and count on the roof; a less efficient cell gives fewer kWp. A
  // monocrystalline module has the efficiency of the chosen panel size.
  panelTypes: [
    { id: "mono", label: "Monokristalin", efficiency: null },
    { id: "poly", label: "Polikristalin", efficiency: 0.15 },
  ],
};

function powerById(id = FINANCE.defaultPower) {
  return POWER_OPTIONS.find((option) => option.id === String(id)) ?? null;
}

// How many panels suit this household: the fewest of what the roof holds, what produces no
// more than the household uses in a year, and what peaks no higher than its connected power.
// Since Permen ESDM 2/2024 power sent to the grid earns nothing, and a house never draws more
// than its connected power at once, anything beyond the last two only goes to waste. The
// regulation itself no longer caps capacity at the connected power; PLN's quota does.
function recommend({ maxPanels, monthlyUseKwh, pvout, panelKw, va }) {
  const limits = [
    ...(Number.isInteger(maxPanels) ? [{ by: "roof", panels: maxPanels }] : []),
    ...(monthlyUseKwh !== null ? [{ by: "use", panels: Math.floor((monthlyUseKwh * 12) / (panelKw * pvout)) }] : []),
    { by: "power", panels: Math.floor(va / 1000 / panelKw) },
  ];
  const binding = limits.reduce((lowest, limit) => (limit.panels < lowest.panels ? limit : lowest));
  const panelCount = Math.min(Math.max(binding.panels, ASSUMPTIONS.minPanels), maxPanels ?? Infinity);
  return {
    panelCount,
    capacityKwp: round(panelCount * panelKw, 2),
    limitedBy: binding.by,
    // Even the smallest worthwhile system is more than this household can use.
    belowMinimum: binding.panels < ASSUMPTIONS.minPanels,
  };
}

// Cost, bill savings and payback of a system of modules of the given size (from solar.PANELS)
// for a household on the given connection. `panelCount` null means the recommended number;
// `maxPanels` is what the roof holds; `monthlyBillRp` may be null when not entered.
//
// Since Permen ESDM 2/2024 power sent to the grid no longer reduces the bill, so the savings
// can never exceed the bill itself. Nor can they exceed what a system as large as the connected
// power produces: a house never draws more than that at once, so the rest goes to waste. This
// matters most when no bill is entered and the viewer picks far more panels than suggested.
function estimateFinance({
  panelCount = null,
  maxPanels,
  pvout,
  monthlyBillRp,
  panelType = "mono",
  panel = DEFAULT_PANEL,
  power = powerById(),
}) {
  const type = FINANCE.panelTypes.find((candidate) => candidate.id === panelType);
  const panelKw = (panel.powerWp / 1000) * ((type.efficiency ?? panel.efficiency) / panel.efficiency);
  const hasBill = monthlyBillRp > 0;
  // Bills and tokens also carry street-lighting tax, left out here.
  const monthlyUseKwh = hasBill ? monthlyBillRp / power.tariffRpPerKwh : null;
  const recommendation = recommend({ maxPanels, monthlyUseKwh, pvout, panelKw, va: power.va });

  const count = panelCount ?? recommendation.panelCount;
  const capacityKwp = count * panelKw;
  const annualKwh = capacityKwp * pvout;
  const investmentRp = capacityKwp * FINANCE.costRpPerKwp;
  const monthlyProductionRp = (annualKwh / 12) * power.tariffRpPerKwh;
  const usableProductionRp = ((Math.min(capacityKwp, power.va / 1000) * pvout) / 12) * power.tariffRpPerKwh;
  const monthlySavingRp = Math.min(monthlyProductionRp, usableProductionRp, hasBill ? monthlyBillRp : Infinity);
  const annualSavingRp = monthlySavingRp * 12;

  return {
    panelCount: count,
    recommendation,
    tariffRpPerKwh: power.tariffRpPerKwh,
    monthlyUseKwh: monthlyUseKwh === null ? null : round(monthlyUseKwh),
    // More than the connection could deliver running flat out all month: likely a typo.
    billAbovePower: monthlyUseKwh !== null && monthlyUseKwh > (power.va / 1000) * HOURS_PER_MONTH,
    capacityKwp: round(capacityKwp, 2),
    annualKwh: round(annualKwh),
    investmentRp: round(investmentRp),
    panelsInverterRp: round(investmentRp * FINANCE.panelsInverterShare),
    bosInstallationRp: round(investmentRp * FINANCE.bosInstallationShare),
    monthlyBillRp: hasBill ? monthlyBillRp : null,
    monthlyProductionRp: round(monthlyProductionRp),
    monthlySavingRp: round(monthlySavingRp),
    limitedByBill: hasBill && monthlyProductionRp > monthlyBillRp && monthlyBillRp <= usableProductionRp,
    limitedByPower: usableProductionRp < monthlyProductionRp && (!hasBill || usableProductionRp < monthlyBillRp),
    paybackYears: annualSavingRp > 0 ? round(investmentRp / annualSavingRp, 1) : null,
    // Cumulative spending per year with and without panels; it needs a bill to compare with.
    projection: hasBill
      ? Array.from({ length: FINANCE.projectionYears + 1 }, (_, year) => ({
          year,
          withoutPvRp: round(monthlyBillRp * 12 * year),
          withPvRp: round(investmentRp + (monthlyBillRp * 12 - annualSavingRp) * year),
        }))
      : null,
  };
}

module.exports = { FINANCE, estimateFinance, powerById };
