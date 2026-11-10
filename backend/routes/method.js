const express = require("express");
const pvout = require("../pvout");
const { REPORTED_ASSUMPTIONS } = require("../roofEstimate");

const router = express.Router();

// The calculation assumptions and PVOUT range, for the "about" page.
router.get("/", async (_request, response) => {
  const rasters = await pvout.rastersReady.catch(() => null);
  response.json({ assumptions: REPORTED_ASSUMPTIONS, pvoutRange: rasters?.range ?? null });
});

module.exports = router;
