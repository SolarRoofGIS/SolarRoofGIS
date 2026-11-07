require("dotenv").config();

const cors = require("cors");
const express = require("express");

const boundariesRoute = require("./routes/boundaries");
const buildingsRoute = require("./routes/buildings");
const healthRoute = require("./routes/health");
const methodRoute = require("./routes/method");
const pvoutRoute = require("./routes/pvout");
const roofsRoute = require("./routes/roofs");
const statsRoute = require("./routes/stats");
const tilesRoute = require("./routes/tiles");

const app = express();

app.use(cors());
app.use(express.json());
app.use("/api", (_request, response, next) => {
  response.set("Cache-Control", "no-store");
  next();
});

app.use("/api/health", healthRoute);
app.use("/api/buildings", buildingsRoute);
app.use("/api/pvout", pvoutRoute);
app.use("/api/roofs", roofsRoute);
app.use("/api/boundaries", boundariesRoute);
app.use("/api/stats", statsRoute);
app.use("/api/method", methodRoute);
app.use("/api/tiles", tilesRoute);

app.use((request, response) => {
  response.status(404).json({ error: "Endpoint tidak ditemukan." });
});

const port = Number(process.env.API_PORT || 5000);
app.listen(port, () => {
  console.log(`SolarRoofGIS API ready at http://localhost:${port}`);
});
