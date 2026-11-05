const express = require("express");
const pvout = require("../pvout");
const { ASSUMPTIONS, PANEL_AREA_M2 } = require("../solar");

const router = express.Router();

// The calculation assumptions and PVOUT range, for the "about" page.
router.get("/", async (_request, response) => {
  const rasters = await pvout.rastersReady.catch(() => null);
  response.json({
    assumptions: { ...ASSUMPTIONS, panelAreaM2: Math.round(PANEL_AREA_M2 * 1000) / 1000 },
    pvoutRange: rasters?.range ?? null,
  });
});

module.exports = router;
