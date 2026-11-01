const express = require("express");
const pvout = require("../pvout");

const router = express.Router();

router.get("/", async (_request, response) => {
  try {
    const raster = await pvout.rastersReady;
    response.json({ range: raster.range });
  } catch (error) {
    response.status(503).json({
      error: "Raster PVOUT tidak dapat dibaca.",
      ...(process.env.NODE_ENV !== "production" ? { detail: error.message } : {}),
    });
  }
});

module.exports = router;
