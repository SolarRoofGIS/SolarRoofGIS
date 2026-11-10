import { memo } from "react";
import { formatNumber } from "../format";
import { METRES_PER_LAT, metresPerLng, openRing, polygonsOf } from "./geometry";
import "./RoofOutline.css";

// Sides shorter than this on screen get no length label, so dense outlines stay readable.
const MIN_LABEL_PX = 26;
const LABEL_GAP_PX = 6;
// Rough size of a 10 px label, for keeping labels from overlapping.
const CHAR_WIDTH_PX = 5.6;
const LABEL_HEIGHT_PX = 11;
// Rough size of the 13 px bold area label inside the roof.
const AREA_CHAR_WIDTH_PX = 7.8;
const AREA_HEIGHT_PX = 15;

// Polygons as lists of open rings of [x, y] in local metres (x east, y south).
function toMetres(geometry) {
  const polygons = polygonsOf(geometry);
  const perLng = metresPerLng(polygons[0][0][0][1]);
  return polygons.map((rings) =>
    rings.map((ring) => openRing(ring).map(([lng, lat]) => [lng * perLng, -lat * METRES_PER_LAT])),
  );
}

function insideRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const [iAbove, jAbove] = [yi > y, yj > y];
    if (iAbove !== jAbove && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function formatLength(metres) {
  return `${formatNumber(metres, metres < 100 ? 1 : 0)} m`;
}

// A length label just outside one side: outside the roof for an outer ring, inside the
// courtyard for a hole. Anchored on the side facing the roof so it never covers the line.
function sideLabel(a, b, metres, ring, isHole) {
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
  const length = Math.hypot(dx, dy);
  if (length < MIN_LABEL_PX) return null;
  const middle = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  let [nx, ny] = [dy / length, -dx / length];
  if (insideRing([middle[0] + nx * 2, middle[1] + ny * 2], ring) !== isHole) [nx, ny] = [-nx, -ny];

  const horizontal = Math.abs(nx) > Math.abs(ny);
  const [x, y] = [middle[0] + nx * LABEL_GAP_PX, middle[1] + ny * LABEL_GAP_PX];
  const text = formatLength(metres);
  const width = text.length * CHAR_WIDTH_PX;
  let left = x - width / 2;
  if (horizontal) left = nx > 0 ? x : x - width;
  let top = y - LABEL_HEIGHT_PX / 2;
  if (!horizontal) top = ny > 0 ? y : y - LABEL_HEIGHT_PX;
  return {
    x,
    y,
    anchor: horizontal ? (nx > 0 ? "start" : "end") : "middle",
    baseline: horizontal ? "middle" : ny > 0 ? "hanging" : "alphabetic",
    text,
    metres,
    box: { left, top, right: left + width, bottom: top + LABEL_HEIGHT_PX },
  };
}

function overlaps(a, b) {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

function distanceToSegment([x, y], [ax, ay], [bx, by]) {
  const [dx, dy] = [bx - ax, by - ay];
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared ? Math.min(Math.max(((x - ax) * dx + (y - ay) * dy) / lengthSquared, 0), 1) : 0;
  return Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
}

// How far a point lies inside the roof: the distance to the nearest side, negative outside it.
function signedDepth(point, screen, sides) {
  const inside = screen.some(
    ([outer, ...holes]) => insideRing(point, outer) && !holes.some((hole) => insideRing(point, hole)),
  );
  const nearest = Math.min(...sides.map(([a, b]) => distanceToSegment(point, a, b)));
  return inside ? nearest : -nearest;
}

// Where a label of this size sits best inside the roof: the spot where its box keeps the most
// room to the nearest side, checked at the box's corners, edge midpoints and centre. A coarse
// grid search, then a finer one around the best cell. Works for L shapes, courtyards and roofs
// in several parts; a roof too narrow for the text gets the least bad spot.
function labelPoint(screen, bounds, [width, height]) {
  const sides = screen.flat().flatMap((ring) => ring.map((corner, v) => [corner, ring[(v + 1) % ring.length]]));
  const offsets = [-0.5, 0, 0.5].flatMap((fx) => [-0.5, 0, 0.5].map((fy) => [fx * width, fy * height]));
  const room = ([x, y]) => {
    if (signedDepth([x, y], screen, sides) <= 0) return -Infinity;
    return Math.min(...offsets.map(([dx, dy]) => signedDepth([x + dx, y + dy], screen, sides)));
  };
  const search = ([left, top, right, bottom], steps) => {
    let best = { point: null, room: -Infinity };
    for (let i = 0; i <= steps; i += 1) {
      for (let j = 0; j <= steps; j += 1) {
        const point = [left + ((right - left) * i) / steps, top + ((bottom - top) * j) / steps];
        const score = room(point);
        if (score > best.room) best = { point, room: score };
      }
    }
    return best;
  };
  const [left, top, right, bottom] = bounds;
  const coarse = search(bounds, 24);
  if (!coarse.point) return null;
  const [cellX, cellY] = [(right - left) / 24, (bottom - top) / 24];
  const [x, y] = coarse.point;
  const fine = search([x - cellX, y - cellY, x + cellX, y + cellY], 8);
  return fine.room > coarse.room ? fine.point : coarse.point;
}

// Longer sides are labelled first; a label that would overlap one already placed is left out.
function placeLabels(candidates, reserved = []) {
  const placed = [...reserved];
  for (const label of [...candidates].sort((a, b) => b.metres - a.metres)) {
    if (!placed.some((other) => overlaps(label.box, other.box))) placed.push(label);
  }
  return placed.slice(reserved.length);
}

// A roof outline scaled into the drawing, optionally with the length of every side, the roof
// area written inside it, or a 10 m scale bar.
function RoofOutline({ geometry, color, sideLengths = false, areaM2, scaleBar = false, label }) {
  const size = { width: 280, height: 200 };
  const margin = sideLengths ? { x: 46, y: 22 } : { x: 18, y: 18 };
  const barSpace = scaleBar ? 16 : 0;
  const polygons = toMetres(geometry);
  const corners = polygons.flat(2);
  const xs = corners.map(([x]) => x);
  const ys = corners.map(([, y]) => y);
  const [minX, minY] = [Math.min(...xs), Math.min(...ys)];
  const [spanX, spanY] = [Math.max(...xs) - minX || 1, Math.max(...ys) - minY || 1];
  const room = {
    width: size.width - margin.x * 2,
    height: size.height - margin.y * 2 - barSpace,
  };
  const scale = Math.min(room.width / spanX, room.height / spanY);
  const offset = [margin.x + (room.width - spanX * scale) / 2, margin.y + (room.height - spanY * scale) / 2];
  const project = ([x, y]) => [(x - minX) * scale + offset[0], (y - minY) * scale + offset[1]];

  const screen = polygons.map((rings) => rings.map((ring) => ring.map(project)));
  const path = screen
    .flat()
    .map((ring) => `M${ring.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join("L")}Z`)
    .join(" ");

  let area = null;
  if (Number.isFinite(areaM2)) {
    const text = `${formatNumber(areaM2)} m²`;
    const width = text.length * AREA_CHAR_WIDTH_PX;
    const [left, top] = project([minX, minY]);
    const point = labelPoint(screen, [left, top, left + spanX * scale, top + spanY * scale], [width, AREA_HEIGHT_PX]);
    if (point) {
      const box = {
        left: point[0] - width / 2,
        top: point[1] - AREA_HEIGHT_PX / 2,
        right: point[0] + width / 2,
        bottom: point[1] + AREA_HEIGHT_PX / 2,
      };
      area = { x: point[0], y: point[1], text, box };
    }
  }

  const labels = sideLengths
    ? placeLabels(
        polygons
          .flatMap((rings, p) =>
            rings.flatMap((ring, r) =>
              ring.map((corner, v) => {
                const next = (v + 1) % ring.length;
                const metres = Math.hypot(ring[next][0] - corner[0], ring[next][1] - corner[1]);
                const onScreen = screen[p][r];
                return sideLabel(onScreen[v], onScreen[next], metres, onScreen, r > 0);
              }),
            ),
          )
          .filter(Boolean),
        area ? [area] : [],
      )
    : [];
  const bar = 10 * scale;

  return (
    <svg className="roof-outline" viewBox={`0 0 ${size.width} ${size.height}`} role="img" aria-label={label}>
      <path d={path} fill={color} fillRule="evenodd" stroke="#1c2421" strokeWidth="1.2" strokeLinejoin="round" />
      {labels.map((side, index) => (
        <text
          key={index}
          className="roof-side-label"
          x={side.x.toFixed(1)}
          y={side.y.toFixed(1)}
          textAnchor={side.anchor}
          dominantBaseline={side.baseline}
        >
          {side.text}
        </text>
      ))}
      {area && (
        <text
          className="roof-area-label"
          x={area.x.toFixed(1)}
          y={area.y.toFixed(1)}
          textAnchor="middle"
          dominantBaseline="central"
        >
          {area.text}
        </text>
      )}
      {scaleBar && (
        <g transform={`translate(${margin.x} ${size.height - 12})`}>
          <path d={`M0,-4V0H${bar}V-4`} fill="none" stroke="#545d59" />
          <text x={bar + 6} y="0" fontSize="11" fill="#545d59">
            10 m
          </text>
        </g>
      )}
    </svg>
  );
}

// Placing the labels is the expensive part, and the panel re-renders far more often than the roof changes.
export default memo(RoofOutline);
