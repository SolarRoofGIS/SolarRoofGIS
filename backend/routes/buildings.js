const express = require("express");
const pool = require("../db");

const router = express.Router();
const MAX_FEATURES = 2500;
const MIN_BUILDING_ZOOM = 15.5;
const STUDY_BOUNDS = [106.401214, -6.788518, 107.227782, -6.302244];

function emptyCollection(message, extra = {}) {
  return {
    type: "FeatureCollection",
    features: [],
    count: 0,
    truncated: false,
    ...(message ? { message } : {}),
    ...extra,
  };
}

router.get("/", async (request, response) => {
  const dataset = String(request.query.dataset || "").toLowerCase();
  if (dataset !== "google") {
    return response.status(400).json({ error: "Dataset yang tersedia: google." });
  }

  const bboxParameter = typeof request.query.bbox === "string" ? request.query.bbox : "";
  const bbox = bboxParameter.split(",").map(Number);
  const zoom = Number(request.query.zoom || 0);
  if (bbox.length !== 4 || !bbox.every(Number.isFinite) || !Number.isFinite(zoom)) {
    return response.status(400).json({ error: "bbox dan zoom harus berupa angka." });
  }

  let [west, south, east, north] = bbox;
  if (west >= east || south >= north || east - west > 180 || north - south > 90) {
    return response.status(400).json({ error: "Urutan bbox tidak valid." });
  }
  if (zoom < MIN_BUILDING_ZOOM) {
    return response.json(
      emptyCollection("Perbesar peta untuk menampilkan bangunan.", {
        minZoom: MIN_BUILDING_ZOOM,
      }),
    );
  }

  west = Math.max(west, STUDY_BOUNDS[0]);
  south = Math.max(south, STUDY_BOUNDS[1]);
  east = Math.min(east, STUDY_BOUNDS[2]);
  north = Math.min(north, STUDY_BOUNDS[3]);
  if (west >= east || south >= north) {
    return response.json(emptyCollection());
  }

  const started = performance.now();
  try {
    const { rows } = await pool.query(
      `WITH query_box AS (
         SELECT ST_MakeEnvelope($1, $2, $3, $4, 4326) AS geom
       )
       SELECT b.id,
              ST_AsGeoJSON(b.geom, 6) AS geometry,
              to_jsonb(b) - 'geom' - 'id' AS properties
       FROM public.buildings_google AS b
       CROSS JOIN query_box AS q
       WHERE b.geom && q.geom
         AND ST_Intersects(b.geom, q.geom)
       LIMIT $5`,
      [west, south, east, north, MAX_FEATURES + 1],
    );

    const truncated = rows.length > MAX_FEATURES;
    const features = rows.slice(0, MAX_FEATURES).map((row) => ({
      type: "Feature",
      id: row.id,
      properties: row.properties || {},
      geometry: typeof row.geometry === "string" ? JSON.parse(row.geometry) : row.geometry,
    }));

    return response.json({
      type: "FeatureCollection",
      features,
      count: features.length,
      truncated,
      limit: MAX_FEATURES,
      dataset,
      bbox: [west, south, east, north],
      elapsedMs: Math.round(performance.now() - started),
    });
  } catch (error) {
    console.error(`Building query failed for ${dataset}:`, error);
    return response.status(500).json({
      error: "Data PostGIS tidak dapat dibaca.",
      ...(process.env.NODE_ENV !== "production" ? { detail: error.message } : {}),
    });
  }
});

module.exports = router;
