const proj4 = require("proj4");

// Roof areas and panel layouts are worked out in UTM zone 48S (EPSG:32748), which covers all
// of Bogor; the map needs longitude and latitude back.
const UTM_48S = "+proj=utm +zone=48 +south +datum=WGS84 +units=m +no_defs";
const toWgs84 = proj4(UTM_48S, "WGS84");

// The same flat-earth scale as frontend/src/map/geometry.js, so the angles below rebuild the
// panels there exactly.
const METRES_PER_LAT = 110574;
const metresPerLng = (latitude) => 111320 * Math.cos((latitude * Math.PI) / 180);

// A panel at [x, y] in UTM with its long side at `angle` (radians from the UTM x axis), as
// [longitude, latitude, angle in degrees counterclockwise from east]. The UTM grid is turned a
// little against true north here, so the angle is measured again after the conversion.
function panelToLngLat([x, y, angle]) {
  const [longitude, latitude] = toWgs84.forward([x, y]);
  const [alongLng, alongLat] = toWgs84.forward([x + Math.cos(angle), y + Math.sin(angle)]);
  const east = (alongLng - longitude) * metresPerLng(latitude);
  const north = (alongLat - latitude) * METRES_PER_LAT;
  const degrees = (Math.atan2(north, east) * 180) / Math.PI;
  return [Number(longitude.toFixed(8)), Number(latitude.toFixed(8)), Number(degrees.toFixed(2))];
}

module.exports = { panelToLngLat };
