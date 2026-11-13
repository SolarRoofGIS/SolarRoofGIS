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

// The panels the server laid out on a roof, each [longitude, latitude, angle of the long side in
// degrees counterclockwise from east], as closed rings of [longitude, latitude].
export function panelRings(panels, { widthM, lengthM }) {
  return panels.map(([longitude, latitude, degrees]) => {
    const angle = (degrees * Math.PI) / 180;
    const [perLng, along, across] = [metresPerLng(latitude), lengthM / 2, widthM / 2];
    const corner = (a, b) => {
      const east = a * along * Math.cos(angle) - b * across * Math.sin(angle);
      const north = a * along * Math.sin(angle) + b * across * Math.cos(angle);
      return [longitude + east / perLng, latitude + north / METRES_PER_LAT];
    };
    const ring = [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)];
    return [...ring, ring[0]];
  });
}

// How many panels the viewer chose for a roof: `choice` is what they typed, null or empty for
// as many as fit. Never fewer than the minimum or more than the roof holds.
export function chosenPanelCount(choice, maxPanels, minPanels) {
  if (choice === null || choice === "") return maxPanels;
  return Math.min(Math.max(Number(choice), minPanels), maxPanels);
}
