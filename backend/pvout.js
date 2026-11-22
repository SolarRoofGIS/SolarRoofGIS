const path = require("path");
// geotiff's CommonJS build require()s an ES-only dependency (quick-lru). Node 22+ allows that,
// but Vercel's function loader does not, so the ES build is loaded with import() instead.
const geotiff = import("geotiff");

// Global Solar Atlas layers clipped to Bogor. PVOUT is the specific yield in kWh/kWp
// (yearly total, or monthly totals in monthly/), about 1 km per pixel; OPTA is the
// optimum panel tilt in degrees on a coarser grid.
const PHOTOVOLTAIC_DIR = process.env.PHOTOVOLTAIC_DIR || path.join(__dirname, "..", "data_bogor", "photovoltaic");
const PVOUT_PATH = process.env.PVOUT_PATH || path.join(PHOTOVOLTAIC_DIR, "PVOUT.tif");
// Pixels masked out by the alpha band are filled from the nearest valid pixel
// within this many cells, so buildings along the clipped edge still get a value.
const EDGE_SEARCH_RADIUS = 2;

async function loadRaster(file) {
  const tiff = await (await geotiff).fromFile(file);
  const image = await tiff.getImage();
  const [values, alpha] = await image.readRasters({ interleave: false });
  const [originX, originY] = image.getOrigin();
  const [resolutionX, resolutionY] = image.getResolution();

  return {
    width: image.getWidth(),
    height: image.getHeight(),
    originX,
    originY,
    resolutionX,
    resolutionY,
    values,
    alpha,
  };
}

function sortedValidValues(raster) {
  const valid = [];
  for (let index = 0; index < raster.values.length; index += 1) {
    if (!raster.alpha || raster.alpha[index] > 0) valid.push(raster.values[index]);
  }
  return valid.sort((a, b) => a - b);
}

function colorRange(valid) {
  const percentile = (p) => valid[Math.round((valid.length - 1) * p)];

  // The 10th–98th percentile keeps the low, mostly uninhabited mountain pixels
  // from flattening the color scale where the buildings actually are.
  return {
    min: Math.round(percentile(0.1)),
    max: Math.round(percentile(0.98)),
    unit: "kWh/kWp",
  };
}

async function loadAll() {
  const monthFiles = Array.from({ length: 12 }, (_, month) =>
    path.join(PHOTOVOLTAIC_DIR, "monthly", `PVOUT_${String(month + 1).padStart(2, "0")}.tif`),
  );
  const [annual, opta, ...monthly] = await Promise.all([
    loadRaster(PVOUT_PATH),
    loadRaster(path.join(PHOTOVOLTAIC_DIR, "OPTA.tif")),
    ...monthFiles.map(loadRaster),
  ]);
  const annualSorted = sortedValidValues(annual);
  return {
    annual,
    annualSorted,
    opta,
    monthly,
    range: colorRange(annualSorted),
    filledGrid: filledGrid(annual),
  };
}

// The annual grid padded by EDGE_SEARCH_RADIUS cells, with every cell already resolved
// through sample(). PostGIS uses it to color vector tiles with a plain array lookup,
// giving the same value the building detail endpoint reports.
function filledGrid(raster) {
  const pad = EDGE_SEARCH_RADIUS;
  const width = raster.width + pad * 2;
  const height = raster.height + pad * 2;
  const originX = raster.originX - pad * raster.resolutionX;
  const originY = raster.originY - pad * raster.resolutionY;
  const values = [];
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      values.push(
        sample(raster, originX + (column + 0.5) * raster.resolutionX, originY + (row + 0.5) * raster.resolutionY),
      );
    }
  }
  return {
    width,
    height,
    originX,
    originY,
    resolutionX: raster.resolutionX,
    resolutionY: raster.resolutionY,
    values,
  };
}

const rastersReady = loadAll();
rastersReady.catch((error) => {
  console.error(`Photovoltaic rasters could not be loaded from ${PHOTOVOLTAIC_DIR}:`, error);
});

function valueAt(raster, column, row) {
  if (column < 0 || row < 0 || column >= raster.width || row >= raster.height) return null;
  const index = row * raster.width + column;
  if (raster.alpha && raster.alpha[index] === 0) return null;
  return raster.values[index];
}

function sample(raster, longitude, latitude) {
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;
  const column = Math.floor((longitude - raster.originX) / raster.resolutionX);
  const row = Math.floor((latitude - raster.originY) / raster.resolutionY);

  for (let radius = 0; radius <= EDGE_SEARCH_RADIUS; radius += 1) {
    let sum = 0;
    let count = 0;
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        const value = valueAt(raster, column + dx, row + dy);
        if (value !== null) {
          sum += value;
          count += 1;
        }
      }
    }
    if (count > 0) return Math.round((sum / count) * 10) / 10;
  }
  return null;
}

// Share of the Bogor study area (valid annual pixels) with a lower PVOUT than `value`.
function rank(rasters, value) {
  if (value === null) return null;
  const sorted = rasters.annualSorted;
  let low = 0;
  let high = sorted.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (sorted[middle] < value) low = middle + 1;
    else high = middle;
  }
  return Math.round((low / sorted.length) * 1000) / 1000;
}

module.exports = { rastersReady, sample, rank };
