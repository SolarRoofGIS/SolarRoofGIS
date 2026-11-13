const express = require("express");
const { errorDetail } = require("../httpErrors");
const { STUDY_BOUNDS } = require("../studyArea");
const pool = require("../db");
const pvout = require("../pvout");
const { estimateAt } = require("../roofEstimate");
const solar = require("../solar");

const router = express.Router();
const MAX_FEATURES = 2500;
const MIN_BUILDING_ZOOM = 15.5;

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
       FROM public.bogor_buildings AS b
       CROSS JOIN query_box AS q
       WHERE b.geom && q.geom
         AND ST_Intersects(b.geom, q.geom)
       LIMIT $5`,
      [west, south, east, north, MAX_FEATURES + 1],
    );

    const raster = await pvout.rastersReady.catch(() => null);
    const truncated = rows.length > MAX_FEATURES;
    const features = rows.slice(0, MAX_FEATURES).map((row) => {
      const properties = row.properties || {};
      return {
        type: "Feature",
        id: row.id,
        properties: {
          ...properties,
          pvout: raster ? pvout.sample(raster.annual, properties.longitude, properties.latitude) : null,
        },
        geometry: typeof row.geometry === "string" ? JSON.parse(row.geometry) : row.geometry,
      };
    });

    return response.json({
      type: "FeatureCollection",
      features,
      count: features.length,
      truncated,
      limit: MAX_FEATURES,
      pvoutRange: raster ? raster.range : null,
      dataset,
      bbox: [west, south, east, north],
      elapsedMs: Math.round(performance.now() - started),
    });
  } catch (error) {
    console.error(`Building query failed for ${dataset}:`, error);
    return response.status(500).json({
      error: "Data PostGIS tidak dapat dibaca.",
      ...errorDetail(error),
    });
  }
});

router.get("/:id", async (request, response) => {
  const id = Number(request.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return response.status(400).json({ error: "ID bangunan tidak valid." });
  }
  const panel = solar.panelById(request.query.panel);
  if (!panel) return response.status(400).json({ error: "Ukuran panel tidak dikenal." });

  try {
    // Areas are measured in UTM zone 48S (EPSG:32748), which covers all of Bogor.
    const { rows } = await pool.query(
      `WITH building AS (
         SELECT b.*,
                ST_Transform(b.geom, 32748) AS geom_utm,
                ST_Buffer(ST_Transform(b.geom, 32748), -$2::float8) AS setback
         FROM public.bogor_buildings AS b
         WHERE b.id = $1
       )
       SELECT b.id,
              b.latitude,
              b.longitude,
              b.confidence,
              b.full_plus_code,
              ST_AsGeoJSON(b.geom, 7)::json AS geometry,
              ST_Area(b.geom_utm) AS footprint_m2,
              ST_Area(b.setback) AS setback_m2,
              ST_AsGeoJSON(b.setback, 3)::json AS setback_geometry,
              (SELECT a.wadmkk
               FROM public.batas_bogor AS a
               WHERE ST_Intersects(a.geom, ST_SetSRID(ST_MakePoint(b.longitude, b.latitude), 4326))
               LIMIT 1) AS region
       FROM building AS b`,
      [id, solar.ASSUMPTIONS.setbackM],
    );
    if (rows.length === 0) {
      return response.status(404).json({ error: "Bangunan tidak ditemukan." });
    }

    const building = rows[0];
    return response.json({
      building: {
        id: building.id,
        latitude: building.latitude,
        longitude: building.longitude,
        confidence: building.confidence,
        plusCode: building.full_plus_code,
        region: building.region,
        geometry: building.geometry,
      },
      ...(await estimateAt({
        footprintM2: building.footprint_m2,
        setbackM2: building.setback_m2,
        setbackGeometry: building.setback_geometry,
        longitude: building.longitude,
        latitude: building.latitude,
        panel,
      })),
    });
  } catch (error) {
    console.error(`Building detail query failed for ${id}:`, error);
    return response.status(500).json({
      error: "Data PostGIS tidak dapat dibaca.",
      ...errorDetail(error),
    });
  }
});

module.exports = router;
