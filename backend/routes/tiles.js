const express = require("express");
const pool = require("../db");
const { panelCountSql, pvoutGridParams, pvoutSql, PANEL_KWP } = require("../buildingSql");

const router = express.Router();
const TILE_EXTENT = 4096;
const CACHE_LIMIT = 3000;
const STUDY_BOUNDS = [106.401214, -6.788518, 107.227782, -6.302244];

// Roofs are tiled at zoom 15–16: a zoom-14 tile over central Bogor holds ~17,000 roofs
// (over 1 MB), a zoom-15 tile about 3,700 (~140 kB). MapLibre overzooms the zoom-16
// tiles (0.15 m precision) for every closer zoom, so there is no need to go further.
const BUILDING_ZOOMS = [15, 16];
// Below that, buildings are summed into grid cells. A cell is about 6 screen pixels:
// 0.002° (~220 m) at zoom 11, halving with every zoom level.
const OVERVIEW_ZOOMS = [8, 14];
const overviewCellSize = (z) => 0.002 / 2 ** (z - 11);

const tileCache = new Map();

function tileBounds(z, x, y) {
  const n = 2 ** z;
  const west = (x / n) * 360 - 180;
  const east = ((x + 1) / n) * 360 - 180;
  const latitude = (row) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * row) / n))) * 180) / Math.PI;
  return [west, latitude(y + 1), east, latitude(y)];
}

function outsideStudyArea([west, south, east, north]) {
  return (
    east < STUDY_BOUNDS[0] || west > STUDY_BOUNDS[2] || north < STUDY_BOUNDS[1] || south > STUDY_BOUNDS[3]
  );
}

function sendTile(response, tile) {
  response.set({
    "Content-Type": "application/vnd.mapbox-vector-tile",
    // Browsers revalidate every tile against Express's ETag (a 304 when unchanged), so a
    // re-import shows up after a reload instead of a day later.
    "Cache-Control": "no-cache",
  });
  response.send(tile);
}

async function buildingTile(z, x, y) {
  const grid = await pvoutGridParams();
  const { rows } = await pool.query(
    `WITH bounds AS (
       SELECT ST_TileEnvelope($1, $2, $3) AS geom_3857,
              ST_Transform(ST_TileEnvelope($1, $2, $3), 4326) AS geom_4326
     ),
     features AS (
       SELECT b.id,
              round(b.area_in_meters)::int AS area,
              round(${pvoutSql("b", 5)})::int AS pvout,
              ST_AsMVTGeom(ST_Transform(b.geom, 3857), bounds.geom_3857, $4, 64, true) AS geom
       FROM public.bogor_buildings AS b, bounds
       WHERE b.geom && bounds.geom_4326
     )
     -- id stays a property too: MapLibre promotes it for hover state and clicks.
     SELECT ST_AsMVT(features, 'buildings', $4, 'geom') AS tile
     FROM features
     WHERE geom IS NOT NULL`,
    [z, x, y, TILE_EXTENT, ...grid],
  );
  return rows[0]?.tile;
}

// Grid cells with the number of buildings, their roof area, mean PVOUT (the cell color),
// and the rough yearly energy if every suitable roof were fitted with panels.
async function overviewTile(z, x, y) {
  const grid = await pvoutGridParams();
  const cell = overviewCellSize(z);
  const { rows } = await pool.query(
    `WITH bounds AS (
       SELECT ST_TileEnvelope($1, $2, $3) AS geom_3857,
              ST_Transform(ST_TileEnvelope($1, $2, $3), 4326) AS geom_4326
     ),
     buildings AS (
       SELECT floor(b.longitude / $5)::int AS cx,
              floor(b.latitude / $5)::int AS cy,
              b.area_in_meters AS area,
              ${pvoutSql("b", 6)} AS pvout
       FROM public.bogor_buildings AS b, bounds
       WHERE b.geom && bounds.geom_4326
     ),
     cells AS (
       SELECT cx, cy,
              count(*)::int AS count,
              round(sum(area))::int AS area,
              round(avg(pvout))::int AS pvout,
              round(sum(${panelCountSql("area")} * ${PANEL_KWP} * coalesce(pvout, 0)) / 1000)::int AS mwh
       FROM buildings
       GROUP BY cx, cy
     ),
     features AS (
       SELECT count, area, pvout, mwh,
              ST_AsMVTGeom(
                ST_Transform(ST_MakeEnvelope(cx * $5, cy * $5, (cx + 1) * $5, (cy + 1) * $5, 4326), 3857),
                bounds.geom_3857, $4, 16, true
              ) AS geom
       FROM cells, bounds
     )
     SELECT ST_AsMVT(features, 'cells', $4, 'geom') AS tile
     FROM features
     WHERE geom IS NOT NULL`,
    [z, x, y, TILE_EXTENT, cell, ...grid],
  );
  return rows[0]?.tile;
}

// Caches the promise so simultaneous requests for one tile share a single query.
function cachedTile(name, build, z, x, y) {
  const key = `${name}/${z}/${x}/${y}`;
  if (!tileCache.has(key)) {
    const pending = build(z, x, y).then((tile) => tile || Buffer.alloc(0));
    if (tileCache.size >= CACHE_LIMIT) tileCache.delete(tileCache.keys().next().value);
    tileCache.set(key, pending);
    pending.catch(() => tileCache.delete(key));
  }
  return tileCache.get(key);
}

function tileRoute(name, [minZoom, maxZoom], build) {
  router.get(`/${name}/:z/:x/:file`, async (request, response) => {
    const z = Number(request.params.z);
    const x = Number(request.params.x);
    const match = /^(\d+)\.pbf$/.exec(request.params.file);
    const y = match ? Number(match[1]) : NaN;
    if (![z, x, y].every(Number.isInteger) || x < 0 || y < 0 || x >= 2 ** z || y >= 2 ** z) {
      return response.status(400).json({ error: "Koordinat tile tidak valid." });
    }
    if (z < minZoom || z > maxZoom || outsideStudyArea(tileBounds(z, x, y))) {
      return sendTile(response, Buffer.alloc(0));
    }

    try {
      return sendTile(response, await cachedTile(name, build, z, x, y));
    } catch (error) {
      console.error(`Tile ${name}/${z}/${x}/${y} failed:`, error);
      return response.status(500).json({
        error: "Tile tidak dapat dibuat.",
        ...(process.env.NODE_ENV !== "production" ? { detail: error.message } : {}),
      });
    }
  });
}

tileRoute("buildings", BUILDING_ZOOMS, buildingTile);
tileRoute("overview", OVERVIEW_ZOOMS, overviewTile);

// The wide overview tiles each sum hundreds of thousands of buildings (1–3 s) and every
// visitor starts there, so zooms 8–11 are built one by one in the background at startup.
async function warmOverview() {
  for (let z = OVERVIEW_ZOOMS[0]; z <= 11; z += 1) {
    const n = 2 ** z;
    const column = (lon) => Math.floor(((lon + 180) / 360) * n);
    const row = (lat) => {
      const rad = (lat * Math.PI) / 180;
      return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n);
    };
    for (let x = column(STUDY_BOUNDS[0]); x <= column(STUDY_BOUNDS[2]); x += 1) {
      for (let y = row(STUDY_BOUNDS[3]); y <= row(STUDY_BOUNDS[1]); y += 1) {
        await cachedTile("overview", overviewTile, z, x, y);
      }
    }
  }
}
warmOverview().catch((error) => console.error("Overview tile warm-up failed:", error));

module.exports = router;
