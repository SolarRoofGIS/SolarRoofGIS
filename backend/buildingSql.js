const pvout = require("./pvout");
const { ASSUMPTIONS, DEFAULT_PANEL } = require("./solar");

// SQL pieces shared by the vector tiles and the summary statistics. Both run over
// millions of buildings, so they avoid per-building geometry work: PVOUT comes from a
// plain array lookup into the raster grid, and the panel count from the footprint area,
// always with the default panel size.

const NO_DATA = -1;

// Parameters for pvoutSql(), in order, starting at the placeholder number it is given.
async function pvoutGridParams() {
  const rasters = await pvout.rastersReady.catch(() => null);
  const grid = rasters?.filledGrid;
  return [
    grid?.originX ?? 0,
    grid?.originY ?? 0,
    grid?.resolutionX ?? 1,
    grid?.resolutionY ?? -1,
    grid?.width ?? 0,
    grid?.height ?? 0,
    // No NULLs in the array: Postgres then indexes it directly instead of walking a null
    // bitmap on every lookup, which made a 850,000-building query take seconds.
    (grid?.values ?? []).map((value) => (value === null ? NO_DATA : value)),
  ];
}

// PVOUT (kWh/kWp) at the building centroid `alias`.longitude/latitude, the same value the
// building detail endpoint reports. `first` is the placeholder number of the first param.
function pvoutSql(alias, first) {
  const p = (offset) => `$${first + offset}`;
  const col = `floor((${alias}.longitude - ${p(0)}) / ${p(2)})::int`;
  const row = `floor((${alias}.latitude - ${p(1)}) / ${p(3)})::int`;
  return `CASE WHEN ${col} BETWEEN 0 AND ${p(4)}::int - 1 AND ${row} BETWEEN 0 AND ${p(5)}::int - 1
               THEN nullif((${p(6)}::real[])[${row} * ${p(4)}::int + ${col} + 1], ${NO_DATA}) END`;
}

// Panel count for a roof of `areaSql` m², treating it as a square for the edge setback.
// The detail endpoint buffers the real outline instead, so it can differ a little for
// long or irregular roofs; good enough for area totals.
function panelCountSql(areaSql) {
  const { setbackM, packingFactor, minPanels } = ASSUMPTIONS;
  const panels = `floor(${packingFactor} * power(greatest(sqrt(${areaSql}) - ${2 * setbackM}, 0), 2) / ${DEFAULT_PANEL.areaM2})`;
  return `(CASE WHEN ${panels} >= ${minPanels} THEN ${panels} ELSE 0 END)`;
}

const PANEL_KWP = DEFAULT_PANEL.powerWp / 1000;

module.exports = { pvoutGridParams, pvoutSql, panelCountSql, PANEL_KWP };
