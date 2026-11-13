// Where whole panels physically fit on a roof outline, laid out in straight rows.
// Coordinates are in metres. Tries the directions of the roof's longest sides, both panel
// orientations and several row starts, and keeps the arrangement holding the most panels;
// each row slides independently.
const ANGLE_CANDIDATES = 4;
const ROW_STARTS = 6;
// Outlines are stored to the millimetre and real sides are never exactly parallel, so a panel
// may touch a side within this margin; without it a row that exactly fits would be rejected.
const FIT_TOLERANCE_M = 0.005;

function rotate([x, y], angle) {
  const [cos, sin] = [Math.cos(angle), Math.sin(angle)];
  return [x * cos - y * sin, x * sin + y * cos];
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

// The [start, end] ranges along x where the whole strip y0..y1 lies on the roof. Any outline edge inside
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
    if (start > reach && insideRings((reach + start) / 2, (y0 + y1) / 2, rings)) runs.push([reach, start]);
    reach = Math.max(reach, end);
  }
  return runs;
}

// Where the first panel of a run starts, given the slack the run leaves: on the column grid
// shared by all rows (panels start at `phase` plus whole pitches) if the slack allows, so the
// rows line up, otherwise as close to it as possible; among grid positions, the one nearest
// the middle of the run.
function runOffset(runStart, slack, pitch, phase) {
  const onGrid = ((((phase - runStart) % pitch) + pitch) % pitch) - pitch;
  let best = null;
  for (let candidate = onGrid; candidate <= slack + pitch; candidate += pitch) {
    const offset = Math.min(Math.max(candidate, 0), Math.max(slack, 0));
    const score = [Math.abs(offset - candidate), Math.abs(offset - slack / 2)];
    if (!best || score[0] < best.score[0] - 1e-9 || (score[0] < best.score[0] + 1e-9 && score[1] < best.score[1])) {
      best = { offset, score };
    }
  }
  return best.offset;
}

// The panels in rows of the given height, the first row starting `start` above the lowest point.
// Returns only the count, or with `collect` also the centre of every panel and its row number.
function layRows(rings, minY, maxY, across, along, gap, start, collect = false) {
  const pitch = along + gap;
  const runs = [];
  let row = 0;
  for (let y = minY + start; y + across <= maxY + FIT_TOLERANCE_M; y += across + gap, row += 1) {
    for (const [runStart, runEnd] of stripRuns(rings, y + FIT_TOLERANCE_M, y + across - FIT_TOLERANCE_M)) {
      const panels = Math.floor((runEnd - runStart + gap + FIT_TOLERANCE_M) / pitch);
      if (panels) runs.push({ runStart, slack: runEnd - runStart - (panels * pitch - gap), panels, y, row });
    }
  }
  const count = runs.reduce((total, run) => total + run.panels, 0);
  if (!collect || !count) return { count, centres: [] };

  // The grid follows the longest run, centred.
  const longest = runs.reduce((best, run) => (run.panels > best.panels ? run : best));
  const phase = longest.runStart + longest.slack / 2;
  const centres = runs.flatMap(({ runStart, slack, panels, y, row: rowNumber }) => {
    const first = runStart + runOffset(runStart, slack, pitch, phase) + along / 2;
    return Array.from({ length: panels }, (_, k) => [first + k * pitch, y + across / 2, rowNumber]);
  });
  return { count, centres };
}

// Panels in the order a smaller system would take them: growing square blocks around the
// middle of the layout, counted in panels and rows, so fewer panels sit together in one block.
function middleFirst(centres, pitch) {
  const rows = centres.map(([, , row]) => row);
  const middleRow = (Math.min(...rows) + Math.max(...rows)) / 2;
  const middleX = centres.reduce((sum, [x]) => sum + x, 0) / centres.length;
  const key = ([x, , row]) => {
    const [u, v] = [Math.abs(x - middleX) / pitch, Math.abs(row - middleRow)];
    return [Math.max(u, v), Math.hypot(u, v), row, x];
  };
  return [...centres].sort((a, b) => {
    const [ka, kb] = [key(a), key(b)];
    return ka.reduce((order, value, i) => order || value - kb[i], 0);
  });
}

// The best arrangement on one polygon: its panel count and each panel as [x, y, angle], the
// angle being the direction of the panel's long side in radians, middle first.
function fitOnPolygon(rings, { widthM, lengthM }, gapM) {
  const [originX, originY] = rings[0][0];
  const local = rings.map((ring) => ring.map(([x, y]) => [x - originX, y - originY]));
  let best = { count: 0 };
  for (const angle of candidateAngles(local)) {
    const turned = local.map((ring) => ring.map((point) => rotate(point, -angle)));
    const ys = turned.flat().map(([, y]) => y);
    const [minY, maxY] = [Math.min(...ys), Math.max(...ys)];
    for (const [across, along] of [
      [widthM, lengthM],
      [lengthM, widthM],
    ]) {
      for (let step = 0; step < ROW_STARTS; step += 1) {
        const start = (step / ROW_STARTS) * (across + gapM);
        const { count } = layRows(turned, minY, maxY, across, along, gapM, start);
        if (count > best.count) best = { count, angle, turned, minY, maxY, across, along, start };
      }
    }
  }
  if (!best.count) return { count: 0, panels: [] };

  const { angle, turned, minY, maxY, across, along, start } = best;
  const { centres } = layRows(turned, minY, maxY, across, along, gapM, start, true);
  const longSide = along === lengthM ? angle : angle + Math.PI / 2;
  return {
    count: best.count,
    panels: middleFirst(centres, along + gapM).map(([cx, cy]) => {
      const [x, y] = rotate([cx, cy], angle);
      return [x + originX, y + originY, longSide];
    }),
  };
}

function interleave(lists) {
  const longest = Math.max(0, ...lists.map((list) => list.length));
  return Array.from({ length: longest }, (_, i) =>
    lists.filter((list) => i < list.length).map((list) => list[i]),
  ).flat();
}

// `geometry` is a GeoJSON Polygon or MultiPolygon in metres, with closed rings; each part is
// laid out on its own. Returns { count, panels }, panels as [x, y, angle] as above, the parts
// taking turns so a smaller system is spread over them.
function fitPanels(geometry, panel, gapM) {
  if (!geometry?.coordinates?.length) return { count: 0, panels: [] };
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  const parts = polygons.filter((rings) => rings.length).map((rings) => fitOnPolygon(rings, panel, gapM));
  return {
    count: parts.reduce((total, part) => total + part.count, 0),
    panels: interleave(parts.map((part) => part.panels)),
  };
}

module.exports = { fitPanels };
