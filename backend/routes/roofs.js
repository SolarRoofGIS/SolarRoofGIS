const express = require("express");
const { errorDetail } = require("../httpErrors");
const { STUDY_BOUNDS } = require("../studyArea");
const pool = require("../db");
const { estimateAt } = require("../roofEstimate");
const solar = require("../solar");

const router = express.Router();
const MAX_VERTICES = 1000;
// Anything larger is not one roof; a large factory or mall is about 5 ha.
const MAX_AREA_M2 = 100000;

// A drawn roof as GeoJSON: a Polygon or MultiPolygon whose rings are closed or open
// lists of [longitude, latitude] inside the study area. Returns an error message or null.
function polygonsOf(geometry) {
  return geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
}

function geometryError(geometry) {
  if (!geometry || !["Polygon", "MultiPolygon"].includes(geometry.type) || !Array.isArray(geometry.coordinates)) {
    return "Bentuk atap harus berupa poligon GeoJSON.";
  }
  let vertices = 0;
  for (const rings of polygonsOf(geometry)) {
    if (!Array.isArray(rings) || rings.length === 0) return "Poligon atap kosong.";
    for (const ring of rings) {
      if (!Array.isArray(ring) || ring.length < 3) return "Setiap poligon atap butuh minimal 3 titik.";
      for (const point of ring) {
        const [longitude, latitude] = Array.isArray(point) ? point : [];
        if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return "Koordinat atap tidak valid.";
        if (
          longitude < STUDY_BOUNDS[0] ||
          longitude > STUDY_BOUNDS[2] ||
          latitude < STUDY_BOUNDS[1] ||
          latitude > STUDY_BOUNDS[3]
        ) {
          return "Atap harus berada di Kota atau Kabupaten Bogor.";
        }
        vertices += 1;
      }
    }
  }
  return vertices > MAX_VERTICES ? `Bentuk atap terlalu rumit (lebih dari ${MAX_VERTICES} titik).` : null;
}

// Rings drawn on the map are left open; PostGIS needs them closed.
function closeRings(geometry) {
  const close = (ring) => {
    const [first, last] = [ring[0], ring[ring.length - 1]];
    return first[0] === last[0] && first[1] === last[1] ? ring : [...ring, first];
  };
  return { type: "MultiPolygon", coordinates: polygonsOf(geometry).map((rings) => rings.map(close)) };
}

router.post("/estimate", async (request, response) => {
  const geometry = request.body?.geometry;
  const error = geometryError(geometry);
  if (error) return response.status(400).json({ error });

  try {
    // The boundary table is optional, so someone without the imported data can still try
    // the drawing tool; the study-area rectangle above is then the only location check.
    const { rows: tables } = await pool.query("SELECT to_regclass('public.batas_bogor') IS NOT NULL AS has_boundaries");
    const regionChecked = tables[0].has_boundaries;
    const regionSql = regionChecked
      ? `(SELECT a.wadmkk
          FROM public.batas_bogor AS a
          WHERE ST_Intersects(a.geom, m.point)
          LIMIT 1)`
      : "NULL::text";

    // Self-crossing outlines are repaired with ST_MakeValid, keeping only the polygon parts.
    const { rows } = await pool.query(
      `WITH input AS (
         SELECT ST_SetSRID(ST_GeomFromGeoJSON($1), 4326) AS raw
       ),
       roof AS (
         SELECT raw,
                ST_Multi(ST_CollectionExtract(ST_MakeValid(raw), 3)) AS geom
         FROM input
       ),
       measured AS (
         SELECT raw,
                geom,
                ST_Transform(geom, 32748) AS geom_utm,
                ST_Buffer(ST_Transform(geom, 32748), -$2::float8) AS setback,
                ST_PointOnSurface(geom) AS point
         FROM roof
         WHERE NOT ST_IsEmpty(geom)
       )
       SELECT ST_IsValid(m.raw) AS valid,
              ST_X(m.point) AS longitude,
              ST_Y(m.point) AS latitude,
              ST_Area(m.geom_utm) AS footprint_m2,
              ST_Area(m.setback) AS setback_m2,
              ST_AsGeoJSON(m.setback, 3)::json AS setback_geometry,
              ST_NPoints(m.geom) - ST_NRings(m.geom) AS vertices,
              ${regionSql} AS region
       FROM measured AS m`,
      [JSON.stringify(closeRings(geometry)), solar.ASSUMPTIONS.setbackM],
    );

    const roof = rows[0];
    if (!roof || roof.footprint_m2 <= 0) {
      return response.status(400).json({ error: "Bentuk atap tidak memiliki luas." });
    }
    if (roof.footprint_m2 > MAX_AREA_M2) {
      return response.status(400).json({
        error: `Bentuk terlalu luas untuk satu atap (lebih dari ${MAX_AREA_M2 / 10000} ha).`,
      });
    }
    if (regionChecked && !roof.region) {
      return response.status(400).json({ error: "Atap harus berada di Kota atau Kabupaten Bogor." });
    }

    return response.json({
      roof: {
        latitude: roof.latitude,
        longitude: roof.longitude,
        region: roof.region,
        regionChecked,
        vertices: roof.vertices,
        repaired: !roof.valid,
      },
      ...(await estimateAt({
        footprintM2: roof.footprint_m2,
        setbackM2: roof.setback_m2,
        setbackGeometry: roof.setback_geometry,
        longitude: roof.longitude,
        latitude: roof.latitude,
      })),
    });
  } catch (queryError) {
    console.error("Drawn roof estimate failed:", queryError);
    return response.status(500).json({
      error: "Perkiraan atap tidak dapat dihitung.",
      ...errorDetail(queryError),
    });
  }
});

module.exports = router;
