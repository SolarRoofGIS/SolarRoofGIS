const pvout = require("./pvout");
const solar = require("./solar");
const { FINANCE } = require("./finance");
const { panelToLngLat } = require("./utm");

// Every assumption behind the figures, as the API reports them; the panel sizes with their
// area and efficiency.
const REPORTED_ASSUMPTIONS = { ...solar.ASSUMPTIONS, panels: solar.PANELS, finance: FINANCE };

// The solar figures for a roof of the given areas at one point, as the API returns them.
// Shared by the database roofs and the roofs drawn on the map, so both follow one method.
// `setbackGeometry` is in UTM zone 48S metres; the panel layout comes back in longitude and
// latitude.
async function estimateAt({ footprintM2, setbackM2, setbackGeometry, longitude, latitude, panel }) {
  const raster = await pvout.rastersReady.catch(() => null);
  const at = (layer) => (raster ? pvout.sample(layer, longitude, latitude) : null);
  const annualPvout = raster ? at(raster.annual) : null;
  const estimate = solar.estimateSolar({
    footprintM2,
    setbackM2,
    setbackGeometry,
    pvout: annualPvout,
    monthlyPvout: raster ? raster.monthly.map(at) : Array(12).fill(null),
    optimumTilt: raster ? at(raster.opta) : null,
    panel,
  });

  return {
    solar: {
      ...estimate,
      layout: { panels: estimate.layout.panels.map(panelToLngLat) },
      pvoutRank: raster ? pvout.rank(raster, annualPvout) : null,
      pvoutRange: raster ? raster.range : null,
    },
    assumptions: REPORTED_ASSUMPTIONS,
  };
}

module.exports = { estimateAt, REPORTED_ASSUMPTIONS };
