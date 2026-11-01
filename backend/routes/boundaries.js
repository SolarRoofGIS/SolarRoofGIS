const express = require("express");
const pool = require("../db");

const router = express.Router();
let cached = null;

// Kota and Kabupaten Bogor outlines, simplified to roughly 50 m so the map can show the
// study area at every zoom without downloading the full-detail boundary.
router.get("/", async (_request, response) => {
  try {
    if (!cached) {
      const { rows } = await pool.query(
        `SELECT json_build_object(
           'type', 'FeatureCollection',
           'features', json_agg(json_build_object(
             'type', 'Feature',
             'id', id,
             'properties', json_build_object(
               'name', CASE WHEN wadmkk = 'Bogor' THEN 'Kabupaten Bogor' ELSE wadmkk END
             ),
             'geometry', ST_AsGeoJSON(ST_SimplifyPreserveTopology(geom, 0.0005), 5)::json
           ))
         ) AS collection
         FROM public.batas_bogor`,
      );
      cached = rows[0].collection;
    }
    response.set("Cache-Control", "public, max-age=86400");
    response.json(cached);
  } catch (error) {
    console.error("Boundary query failed:", error);
    response.status(500).json({
      error: "Batas wilayah tidak dapat dibaca.",
      ...(process.env.NODE_ENV !== "production" ? { detail: error.message } : {}),
    });
  }
});

module.exports = router;
