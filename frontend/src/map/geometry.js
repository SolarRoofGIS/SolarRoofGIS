// Flat-earth conversions; within one roof the error is far below a square metre.
export const METRES_PER_LAT = 110574;

export function metresPerLng(latitude) {
  return 111320 * Math.cos((latitude * Math.PI) / 180);
}

// A GeoJSON Polygon or MultiPolygon as a list of polygons, each a list of rings.
export function polygonsOf(geometry) {
  return geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
}

// A ring without the repeated closing point, if it has one.
export function openRing(ring) {
  const [first, last] = [ring[0], ring[ring.length - 1]];
  return first[0] === last[0] && first[1] === last[1] ? ring.slice(0, -1) : ring;
}
