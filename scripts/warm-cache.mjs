// Requests the heavy read-only API answers once, so the first visitors after a deployment do
// not wait for them: the overview tiles of zoom 8–11 over the study area and the summary
// statistics. The backend keeps them in the database (backend/apiCache.js), so this only
// computes what a code change made stale.
//
// Usage: node scripts/warm-cache.mjs https://site [--wait-for <commit sha>]
// With --wait-for it first waits, up to 15 minutes, until the site reports that commit as live
// (GET /api/health), so it can run right after a push while Vercel is still building.
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { STUDY_BOUNDS } = require("../backend/studyArea.js");
const args = process.argv.slice(2);
const waitIndex = args.indexOf("--wait-for");
const waitFor = waitIndex >= 0 ? args.splice(waitIndex, 2)[1] : null;
const base = (args[0] || process.env.SITE_URL || "").replace(/\/$/, "");
if (!base) {
  console.error("Usage: node scripts/warm-cache.mjs <site URL> [--wait-for <commit sha>]");
  process.exit(1);
}

if (waitFor) {
  const deadline = Date.now() + 15 * 60 * 1000;
  for (;;) {
    const live = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(30000) })
      .then((response) => response.json())
      .then((health) => health.commit)
      .catch(() => null);
    if (live === waitFor) break;
    if (Date.now() > deadline) {
      console.error(`The site still serves ${live ?? "an unknown commit"}, not ${waitFor}.`);
      process.exit(1);
    }
    console.log(`Waiting for ${waitFor.slice(0, 7)} to go live (now ${live ? live.slice(0, 7) : "unknown"})…`);
    await new Promise((resolve) => setTimeout(resolve, 15000));
  }
  console.log(`${waitFor.slice(0, 7)} is live.`);
}

// The same tile URLs the map requests, including its cache-busting version.
const mapStyle = fs.readFileSync(new URL("../frontend/src/map/mapStyle.js", import.meta.url), "utf8");
const tileVersion = /TILE_VERSION = (\d+)/.exec(mapStyle)[1];

const column = (lon, n) => Math.floor(((lon + 180) / 360) * n);
const row = (lat, n) => {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n);
};
const paths = ["/api/stats", "/api/boundaries", "/api/method", "/api/pvout"];
for (let z = 8; z <= 11; z += 1) {
  const n = 2 ** z;
  for (let x = column(STUDY_BOUNDS[0], n); x <= column(STUDY_BOUNDS[2], n); x += 1) {
    for (let y = row(STUDY_BOUNDS[3], n); y <= row(STUDY_BOUNDS[1], n); y += 1) {
      paths.push(`/api/tiles/overview/${z}/${x}/${y}.pbf?v=${tileVersion}`);
    }
  }
}

// A few at a time: each uncached tile is one heavy query on a small database.
const failures = [];
const queue = [...paths];
async function worker() {
  for (let path = queue.shift(); path; path = queue.shift()) {
    const started = Date.now();
    try {
      const response = await fetch(base + path, { signal: AbortSignal.timeout(90000) });
      await response.arrayBuffer();
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      console.log(`${response.status} ${Date.now() - started} ms ${path}`);
    } catch (error) {
      failures.push(path);
      console.error(`failed ${path}: ${error.message}`);
    }
  }
}
await Promise.all(Array.from({ length: 3 }, worker));
console.log(`${paths.length - failures.length} of ${paths.length} warmed`);
process.exit(failures.length ? 1 : 0);
