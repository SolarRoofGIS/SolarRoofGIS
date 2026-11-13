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
  // Common monocrystalline module sizes sold in Indonesia, by cell count: 108 and 144 half-cut
  // 182 mm cells, and 132 half-cut 210 mm cells. The viewer picks one; the default is also
  // the one behind the map colours and the overview figures.
  panels: [
    { id: "430", widthM: 1.134, lengthM: 1.722, powerWp: 430 },
    { id: "550", widthM: 1.134, lengthM: 2.278, powerWp: 550 },
    { id: "670", widthM: 1.303, lengthM: 2.384, powerWp: 670 },
  ],
  defaultPanel: "550",
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

// Each panel size with its area and the efficiency that follows from it.
const PANELS = ASSUMPTIONS.panels.map((panel) => {
  const areaM2 = panel.widthM * panel.lengthM;
  return { ...panel, areaM2, efficiency: panel.powerWp / (areaM2 * 1000) };
});
const DEFAULT_PANEL = PANELS.find((panel) => panel.id === ASSUMPTIONS.defaultPanel);

// The panel size a request asks for by id, the default when it names none, null if unknown.
function panelById(id) {
  if (id === undefined || id === null || id === "") return DEFAULT_PANEL;
  return PANELS.find((panel) => panel.id === String(id)) ?? null;
}

function round(value, digits = 0) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

// The packing factor sets how much of the roof may be used; the layout then checks that those
// panels really fit its shape, which matters on narrow or irregular roofs. `layout.panels`
// holds where the counted panels go, as [x, y, angle] in the metres of `setbackGeometry`,
// middle first.
function estimateSolar({ footprintM2, setbackM2, setbackGeometry, pvout, monthlyPvout, optimumTilt, panel }) {
  const usableM2 = Math.max(setbackM2, 0) * ASSUMPTIONS.packingFactor;
  const areaPanels = Math.floor(usableM2 / panel.areaM2);
  const layout = fitPanels(setbackGeometry, panel, ASSUMPTIONS.panelGapM);
  const layoutPanels = layout.count;
  const panelCount = Math.min(areaPanels, layoutPanels);
  const suitable = panelCount >= ASSUMPTIONS.minPanels && pvout !== null;
  const capacityKwp = suitable ? (panelCount * panel.powerWp) / 1000 : 0;
  const annualKwh = suitable ? capacityKwp * pvout : 0;

  return {
    suitable,
    footprintM2: round(footprintM2, 1),
    usableM2: round(usableM2, 1),
    usableShare: footprintM2 > 0 ? round(usableM2 / footprintM2, 3) : 0,
    panel: { id: panel.id, widthM: panel.widthM, lengthM: panel.lengthM, powerWp: panel.powerWp },
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
    layout: { panels: suitable ? layout.panels.slice(0, panelCount) : [] },
  };
}

module.exports = { ASSUMPTIONS, PANELS, DEFAULT_PANEL, panelById, estimateSolar, round };
