const { ASSUMPTIONS, DEFAULT_PANEL, round } = require("./solar");

// Planning-level financial assumptions, adjust here; the API and the panel follow.
const FINANCE = {
  // Installed cost of a rooftop system, split into hardware and the rest.
  costRpPerKwp: 15000000,
  panelsInverterShare: 0.85,
  bosInstallationShare: 0.15,
  defaultMonthlyBillRp: 1500000,
  // The usual performance warranty of a panel, and the length of the cost projection.
  projectionYears: 25,
  // Same module size and count on the roof; a less efficient cell gives fewer kWp. A
  // monocrystalline module has the efficiency of the chosen panel size.
  panelTypes: [
    { id: "mono", label: "Monokristalin", efficiency: null },
    { id: "poly", label: "Polikristalin", efficiency: 0.15 },
  ],
};

// Cost, bill savings and payback of a system of `panelCount` modules of the given size (from
// solar.PANELS). `monthlyBillRp` may be null when the viewer has not entered a bill.
//
// Since Permen ESDM 2/2024 power sent to the grid no longer reduces the bill, so the savings
// can never exceed the bill itself.
function estimateFinance({ panelCount, pvout, monthlyBillRp, panelType = "mono", panel = DEFAULT_PANEL }) {
  const type = FINANCE.panelTypes.find((candidate) => candidate.id === panelType);
  const efficiency = type.efficiency ?? panel.efficiency;
  const typeCapacityKwp = ((panelCount * panel.powerWp) / 1000) * (efficiency / panel.efficiency);
  const annualKwh = typeCapacityKwp * pvout;
  const investmentRp = typeCapacityKwp * FINANCE.costRpPerKwp;
  const monthlyProductionRp = (annualKwh / 12) * ASSUMPTIONS.tariffRpPerKwh;
  const hasBill = monthlyBillRp > 0;
  const monthlySavingRp = hasBill ? Math.min(monthlyProductionRp, monthlyBillRp) : monthlyProductionRp;
  const annualSavingRp = monthlySavingRp * 12;

  return {
    panelCount,
    capacityKwp: round(typeCapacityKwp, 2),
    annualKwh: round(annualKwh),
    investmentRp: round(investmentRp),
    panelsInverterRp: round(investmentRp * FINANCE.panelsInverterShare),
    bosInstallationRp: round(investmentRp * FINANCE.bosInstallationShare),
    monthlyBillRp: hasBill ? monthlyBillRp : null,
    monthlyProductionRp: round(monthlyProductionRp),
    monthlySavingRp: round(monthlySavingRp),
    limitedByBill: hasBill && monthlyProductionRp > monthlyBillRp,
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

module.exports = { FINANCE, estimateFinance };
