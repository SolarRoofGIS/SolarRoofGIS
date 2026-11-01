const express = require("express");
const pool = require("../db");

const router = express.Router();

router.get("/", async (_request, response) => {
  try {
    const { rows } = await pool.query(
      'SELECT current_database() AS database, PostGIS_Full_Version() AS "postgisVersion"',
    );
    const { rows: tableRows } = await pool.query(
      "SELECT to_regclass('public.bogor_buildings') IS NOT NULL AS available",
    );
    const available = tableRows[0].available;

    response.json({
      ok: available,
      storage: "PostGIS",
      database: rows[0].database,
      postgisVersion: rows[0].postgisVersion,
      datasets: { google: { available, features: null } },
    });
  } catch (error) {
    console.error("PostGIS health check failed:", error);
    response.status(503).json({
      ok: false,
      storage: "PostGIS",
      ...(process.env.NODE_ENV !== "production" ? { detail: error.message } : {}),
      datasets: { google: { available: false } },
    });
  }
});

module.exports = router;
