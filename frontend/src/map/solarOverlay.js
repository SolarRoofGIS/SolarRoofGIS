import { pvoutRgb } from "./colors";
import { polygonsOf } from "./geometry";

// Each ~1 km PVOUT cell becomes this many pixels, so the smoothed surface and the
// boundary clip stay sharp when the map is zoomed in.
const SCALE = 10;

// A transparent pixel for the image source until the PVOUT grid has loaded.
export const EMPTY_IMAGE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

// The PVOUT grid from /api/pvout/grid as a MapLibre image source: one colored pixel per
// cell, scaled up with bilinear smoothing and cut to the Kota and Kabupaten Bogor outline.
export function buildSolarOverlay(grid, boundary) {
  const { width, height, originX, originY, resolutionX, resolutionY, values, range } = grid;

  const cells = document.createElement("canvas");
  cells.width = width;
  cells.height = height;
  const cellContext = cells.getContext("2d");
  const pixels = cellContext.createImageData(width, height);
  values.forEach((value, index) => {
    if (value !== null) pixels.data.set([...pvoutRgb(value, range), 255], index * 4);
  });
  cellContext.putImageData(pixels, 0, 0);

  const canvas = document.createElement("canvas");
  canvas.width = width * SCALE;
  canvas.height = height * SCALE;
  const context = canvas.getContext("2d");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  // Over half a degree of latitude, Web Mercator is linear to within a pixel, so the
  // outline can be drawn straight in grid coordinates.
  const toPixel = ([lon, lat]) => [((lon - originX) / resolutionX) * SCALE, ((lat - originY) / resolutionY) * SCALE];
  // One clip per region: Kabupaten Bogor has Kota Bogor as a hole.
  for (const feature of boundary.features) {
    context.save();
    context.beginPath();
    for (const ring of polygonsOf(feature.geometry).flat()) {
      ring.map(toPixel).forEach(([x, y], index) => (index === 0 ? context.moveTo(x, y) : context.lineTo(x, y)));
      context.closePath();
    }
    context.clip("evenodd");
    context.drawImage(cells, 0, 0, canvas.width, canvas.height);
    context.restore();
  }

  const east = originX + width * resolutionX;
  const south = originY + height * resolutionY;
  return {
    url: canvas.toDataURL("image/png"),
    coordinates: [
      [originX, originY],
      [east, originY],
      [east, south],
      [originX, south],
    ],
  };
}
