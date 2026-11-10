const express = require("express");
const { errorDetail } = require("../httpErrors");
const pvout = require("../pvout");

const router = express.Router();

function sendRasterError(response, error) {
  response.status(503).json({
    error: "Raster PVOUT tidak dapat dibaca.",
    ...errorDetail(error),
  });
}

router.get("/", async (_request, response) => {
  try {
    const raster = await pvout.rastersReady;
    response.json({ range: raster.range });
  } catch (error) {
    sendRasterError(response, error);
  }
});

// The annual PVOUT grid (about 1 km cells) for the map's solar overlay. It is the same
// edge-filled grid the tiles use, so the overlay matches the roof colors. Row 0 is north.
router.get("/grid", async (_request, response) => {
  try {
    const { filledGrid, range } = await pvout.rastersReady;
    response.set("Cache-Control", "no-cache");
    response.json({ ...filledGrid, range });
  } catch (error) {
    sendRasterError(response, error);
  }
});

module.exports = router;
