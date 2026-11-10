const pvout = require("./pvout");
const solar = require("./solar");
const { FINANCE } = require("./finance");

// Every assumption behind the figures, as the API reports them.
const REPORTED_ASSUMPTIONS = { ...solar.ASSUMPTIONS, panelAreaM2: solar.PANEL_AREA_M2, finance: FINANCE };

// The solar figures for a roof of the given areas at one point, as the API returns them.
// Shared by the database roofs and the roofs drawn on the map, so both follow one method.
async function estimateAt({ footprintM2, setbackM2, setbackGeometry, longitude, latitude }) {
  const raster = await pvout.rastersReady.catch(() => null);
  const at = (layer) => (raster ? pvout.sample(layer, longitude, latitude) : null);
  const annualPvout = raster ? at(raster.annual) : null;

  return {
    solar: {
      ...solar.estimateSolar({
        footprintM2,
        setbackM2,
        setbackGeometry,
        pvout: annualPvout,
        monthlyPvout: raster ? raster.monthly.map(at) : Array(12).fill(null),
        optimumTilt: raster ? at(raster.opta) : null,
      }),
      pvoutRank: raster ? pvout.rank(raster, annualPvout) : null,
      pvoutRange: raster ? raster.range : null,
    },
    assumptions: REPORTED_ASSUMPTIONS,
  };
}

module.exports = { estimateAt, REPORTED_ASSUMPTIONS };
