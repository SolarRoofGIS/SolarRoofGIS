// How many whole panels physically fit on a roof outline, laid out in straight rows.
// Coordinates are in metres. Tries the directions of the roof's longest sides, both panel
// orientations and several row starts, and keeps the best; each row slides independently.
const ANGLE_CANDIDATES = 4;
const ROW_STARTS = 6;
// Outlines are stored to the millimetre and real sides are never exactly parallel, so a panel
// may touch a side within this margin; without it a row that exactly fits would be rejected.
const FIT_TOLERANCE_M = 0.005;

function rotateRing(ring, angle) {
  const [cos, sin] = [Math.cos(angle), Math.sin(angle)];
  return ring.map(([x, y]) => [x * cos - y * sin, x * sin + y * cos]);
}

// Roof directions worth aligning rows to: the angles (modulo 90°, to the nearest degree)
// carrying the most outline length.
function candidateAngles(rings) {
  const lengthByDegree = new Map();
  for (const ring of rings) {
    for (let i = 0; i + 1 < ring.length; i += 1) {
      const [dx, dy] = [ring[i + 1][0] - ring[i][0], ring[i + 1][1] - ring[i][1]];
      const angle = ((Math.atan2(dy, dx) % (Math.PI / 2)) + Math.PI / 2) % (Math.PI / 2);
      const degree = Math.round((angle * 180) / Math.PI) % 90;
      const entry = lengthByDegree.get(degree) ?? { length: 0, angle };
      entry.length += Math.hypot(dx, dy);
      lengthByDegree.set(degree, entry);
    }
  }
  return [...lengthByDegree.values()]
    .sort((a, b) => b.length - a.length)
    .slice(0, ANGLE_CANDIDATES)
    .map((entry) => entry.angle);
}

function insideRings(x, y, rings) {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0; i + 1 < ring.length; i += 1) {
      const [[xa, ya], [xb, yb]] = [ring[i], ring[i + 1]];
      const [aAbove, bAbove] = [ya > y, yb > y];
      if (aAbove !== bAbove && x < ((xb - xa) * (y - ya)) / (yb - ya) + xa) inside = !inside;
    }
  }
  return inside;
}

// The lengths along x where the whole strip y0..y1 lies on the roof. Any outline edge inside
// the strip blocks the x range it covers; what remains is entirely inside or entirely outside.
function stripRuns(rings, y0, y1) {
  const blocked = [];
  for (const ring of rings) {
    for (let i = 0; i + 1 < ring.length; i += 1) {
      const [[xa, ya], [xb, yb]] = [ring[i], ring[i + 1]];
      if (Math.max(ya, yb) <= y0 || Math.min(ya, yb) >= y1) continue;
      const xAt = (y) => xa + ((xb - xa) * (y - ya)) / (yb - ya);
      const [low, high] = [Math.max(Math.min(ya, yb), y0), Math.min(Math.max(ya, yb), y1)];
      const [p, q] = ya === yb ? [xa, xb] : [xAt(low), xAt(high)];
      blocked.push([Math.min(p, q), Math.max(p, q)]);
    }
  }
  blocked.sort((a, b) => a[0] - b[0]);

  const runs = [];
  let reach = blocked.length ? blocked[0][1] : 0;
  for (let i = 1; i < blocked.length; i += 1) {
    const [start, end] = blocked[i];
    if (start > reach && insideRings((reach + start) / 2, (y0 + y1) / 2, rings)) runs.push(start - reach);
    reach = Math.max(reach, end);
  }
  return runs;
}

// Panels in rows of the given height, starting the first row `start` above the lowest point.
function countRows(rings, minY, maxY, across, along, gap, start) {
  let panels = 0;
  for (let y = minY + start; y + across <= maxY + FIT_TOLERANCE_M; y += across + gap) {
    for (const run of stripRuns(rings, y + FIT_TOLERANCE_M, y + across - FIT_TOLERANCE_M)) {
      panels += Math.floor((run + gap + FIT_TOLERANCE_M) / (along + gap));
    }
  }
  return panels;
}

function fitOnPolygon(rings, { widthM, lengthM }, gapM) {
  const [originX, originY] = rings[0][0];
  const local = rings.map((ring) => ring.map(([x, y]) => [x - originX, y - originY]));
  let best = 0;
  for (const angle of candidateAngles(local)) {
    const turned = local.map((ring) => rotateRing(ring, -angle));
    const ys = turned.flat().map(([, y]) => y);
    const [minY, maxY] = [Math.min(...ys), Math.max(...ys)];
    for (const [across, along] of [
      [widthM, lengthM],
      [lengthM, widthM],
    ]) {
      for (let step = 0; step < ROW_STARTS; step += 1) {
        const start = (step / ROW_STARTS) * (across + gapM);
        best = Math.max(best, countRows(turned, minY, maxY, across, along, gapM, start));
      }
    }
  }
  return best;
}

// `geometry` is a GeoJSON Polygon or MultiPolygon in metres, with closed rings; each part is
// laid out on its own.
function fitPanels(geometry, panel, gapM) {
  if (!geometry?.coordinates?.length) return 0;
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  return polygons.reduce((total, rings) => total + (rings.length ? fitOnPolygon(rings, panel, gapM) : 0), 0);
}

module.exports = { fitPanels };
