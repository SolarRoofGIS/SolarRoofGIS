const express = require("express");
const { errorDetail } = require("../httpErrors");
const { remember } = require("../apiCache");
const pool = require("../db");
const { panelCountSql, pvoutGridParams, pvoutSql, PANEL_KWP } = require("../buildingSql");

const router = express.Router();

// Totals for the home page, per region. Counting 2.7 million building centroids against
// the boundaries takes 15–30 s even with subdivided polygons, so the result is kept in the
// database (see apiCache.js) and a long-running server computes it at startup.
async function computeStats() {
  const grid = await pvoutGridParams();
  const { rows } = await pool.query(
    `WITH regions AS (
       SELECT CASE WHEN wadmkk = 'Bogor' THEN 'Kabupaten Bogor' ELSE wadmkk END AS name,
              ST_Subdivide(geom, 128) AS geom
       FROM public.batas_bogor
     ),
     buildings AS (
       SELECT r.name,
              b.area_in_meters AS area,
              ${pvoutSql("b", 1)} AS pvout
       FROM public.bogor_buildings AS b
       JOIN regions AS r
         ON b.geom && r.geom
        AND ST_Intersects(r.geom, ST_SetSRID(ST_MakePoint(b.longitude, b.latitude), 4326))
     )
     SELECT name,
            count(*)::int AS buildings,
            round(sum(area))::bigint AS roof_area_m2,
            count(*) FILTER (WHERE ${panelCountSql("area")} > 0)::int AS suitable_buildings,
            round(sum(${panelCountSql("area")} * ${PANEL_KWP}))::bigint AS capacity_kwp,
            round(sum(${panelCountSql("area")} * ${PANEL_KWP} * coalesce(pvout, 0)) / 1e6)::bigint AS annual_gwh,
            round(min(pvout))::int AS pvout_min,
            round(max(pvout))::int AS pvout_max
     FROM buildings
     GROUP BY name
     ORDER BY name`,
    grid,
  );

  const regions = rows.map((row) => ({
    name: row.name,
    buildings: row.buildings,
    roofAreaM2: Number(row.roof_area_m2),
    suitableBuildings: row.suitable_buildings,
    capacityKwp: Number(row.capacity_kwp),
    annualGwh: Number(row.annual_gwh),
    pvoutMin: row.pvout_min,
    pvoutMax: row.pvout_max,
  }));
  const sum = (key) => regions.reduce((total, region) => total + region[key], 0);

  return {
    total: {
      buildings: sum("buildings"),
      roofAreaM2: sum("roofAreaM2"),
      suitableBuildings: sum("suitableBuildings"),
      capacityKwp: sum("capacityKwp"),
      annualGwh: sum("annualGwh"),
    },
    regions,
  };
}

let statsPromise = null;
function statsReady() {
  if (!statsPromise) {
    statsPromise = remember("stats", async () => Buffer.from(JSON.stringify(await computeStats())))
      .then((body) => JSON.parse(body.toString("utf8")))
      .catch((error) => {
        statsPromise = null;
        throw error;
      });
  }
  return statsPromise;
}
if (!process.env.VERCEL) statsReady().catch((error) => console.error("Summary statistics failed:", error));

router.get("/", async (_request, response) => {
  try {
    response.set("Cache-Control", "no-cache");
    response.json(await statsReady());
  } catch (error) {
    response.status(503).json({
      error: "Statistik belum dapat dihitung.",
      ...errorDetail(error),
    });
  }
});

module.exports = router;
