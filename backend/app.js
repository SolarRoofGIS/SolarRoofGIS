// The Express app, shared by the local server (server.js) and the Vercel function (api/index.js).
require("dotenv").config();

const cors = require("cors");
const express = require("express");

const boundariesRoute = require("./routes/boundaries");
const buildingsRoute = require("./routes/buildings");
const healthRoute = require("./routes/health");
const methodRoute = require("./routes/method");
const pvoutRoute = require("./routes/pvout");
const roofsRoute = require("./routes/roofs");
const financeRoute = require("./routes/finance");
const statsRoute = require("./routes/stats");
const tilesRoute = require("./routes/tiles");

const app = express();
// Do not advertise the server framework in every response.
app.disable("x-powered-by");

app.use(cors());
app.use(express.json());
app.use("/api", (request, response, next) => {
  response.set("Cache-Control", "no-store");
  // On Vercel the CDN keeps the read-only answers (tiles, statistics, roof details), so the
  // heavy PostGIS queries run once per deployment and region instead of for every visitor.
  // Browsers still revalidate; a new deployment clears the CDN cache.
  if (process.env.VERCEL && request.method === "GET" && !request.path.startsWith("/health")) {
    response.set("Vercel-CDN-Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
  }
  next();
});

app.use("/api/health", healthRoute);
app.use("/api/buildings", buildingsRoute);
app.use("/api/pvout", pvoutRoute);
app.use("/api/roofs", roofsRoute);
app.use("/api/finance", financeRoute);
app.use("/api/boundaries", boundariesRoute);
app.use("/api/stats", statsRoute);
app.use("/api/method", methodRoute);
app.use("/api/tiles", tilesRoute);

app.use((request, response) => {
  response.status(404).json({ error: "Endpoint tidak ditemukan." });
});

module.exports = app;
