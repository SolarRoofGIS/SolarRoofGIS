const { fitPanels } = require("./panelLayout");

// Rooftop PV estimate for one building. Not the whole roof can hold panels, so the
// estimate goes footprint → usable area → whole panels → installed kWp → energy.
// Every figure is a planning-level assumption; adjust here, the API and the panel follow.
const ASSUMPTIONS = {
  // Clear strip kept free along every roof edge (wind load, maintenance, gutters).
  // Applied as a negative buffer on the footprint in PostGIS.
  setbackM: 0.5,
  // Share of the remaining roof that can actually take panels: roof pitch and
  // orientation, ridges, water tanks, skylights, shading and access paths.
  packingFactor: 0.7,
  // A common monocrystalline module sold in Indonesia.
  panel: { widthM: 1.134, lengthM: 2.278, powerWp: 550 },
  // Clamp gap between neighbouring panels when they are laid out on the roof.
  panelGapM: 0.02,
  // Smaller roofs are reported as not worth an installation.
  minPanels: 2,
  // Global Solar Atlas PVOUT already includes typical system losses
  // (inverter, cabling, soiling, temperature), so no extra derating is applied.

  // PLN household tariff R-1 ≥ 1,300 VA, used only to put a value on the energy.
  tariffRpPerKwh: 1444.7,
  // Grid emission factor for the Java–Madura–Bali system, kg CO₂ per kWh.
  gridEmissionKgPerKwh: 0.87,
};

const PANEL_AREA_M2 = ASSUMPTIONS.panel.widthM * ASSUMPTIONS.panel.lengthM;

function round(value, digits = 0) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

// The packing factor sets how much of the roof may be used; the layout then checks that those
// panels really fit its shape, which matters on narrow or irregular roofs.
function estimateSolar({ footprintM2, setbackM2, setbackGeometry, pvout, monthlyPvout, optimumTilt }) {
  const usableM2 = Math.max(setbackM2, 0) * ASSUMPTIONS.packingFactor;
  const areaPanels = Math.floor(usableM2 / PANEL_AREA_M2);
  const layoutPanels = fitPanels(setbackGeometry, ASSUMPTIONS.panel, ASSUMPTIONS.panelGapM);
  const panelCount = Math.min(areaPanels, layoutPanels);
  const suitable = panelCount >= ASSUMPTIONS.minPanels && pvout !== null;
  const capacityKwp = suitable ? (panelCount * ASSUMPTIONS.panel.powerWp) / 1000 : 0;
  const annualKwh = suitable ? capacityKwp * pvout : 0;

  return {
    suitable,
    footprintM2: round(footprintM2, 1),
    usableM2: round(usableM2, 1),
    usableShare: footprintM2 > 0 ? round(usableM2 / footprintM2, 3) : 0,
    panelCount: suitable ? panelCount : 0,
    layoutPanels,
    limitedByLayout: layoutPanels < areaPanels,
    capacityKwp: round(capacityKwp, 2),
    pvout,
    optimumTilt,
    annualKwh: round(annualKwh),
    monthlyKwh: monthlyPvout.map((value) => (suitable && value !== null ? round(capacityKwp * value) : 0)),
    annualValueRp: round(annualKwh * ASSUMPTIONS.tariffRpPerKwh, -3),
    annualCo2Kg: round(annualKwh * ASSUMPTIONS.gridEmissionKgPerKwh),
  };
}

module.exports = { ASSUMPTIONS, PANEL_AREA_M2, estimateSolar, round };
