// Drawing and reshaping one roof outline on the MapLibre map. The outline is kept as a list
// of polygons, each a list of open rings (outer ring first, then holes) of [lng, lat].
// It is shown through the "draft" source and its layers, defined with the map style.
import { METRES_PER_LAT, metresPerLng, openRing, polygonsOf } from "./geometry";

// Screen distances in pixels.
const SNAP_PX = 12;
const CLOSE_PX = 10;
const DUPLICATE_PX = 4;
const HANDLE_PX = 8;

const EMPTY = { type: "FeatureCollection", features: [] };
const MAP_EVENTS = [
  ["click", "onClick"],
  ["dblclick", "onDblClick"],
  ["mousemove", "onMove"],
  ["touchmove", "onMove"],
  ["mousedown", "onDown"],
  ["touchstart", "onDown"],
  ["mouseup", "onUp"],
  ["touchend", "onUp"],
  ["contextmenu", "onContextMenu"],
];

function point(coordinates, properties) {
  return { type: "Feature", geometry: { type: "Point", coordinates }, properties };
}

function closeRing(ring) {
  return [...ring, ring[0]];
}

function toGeometry(polygons) {
  const coordinates = polygons.map((rings) => rings.map(closeRing));
  return coordinates.length === 1
    ? { type: "Polygon", coordinates: coordinates[0] }
    : { type: "MultiPolygon", coordinates };
}

function fromGeometry(geometry) {
  return polygonsOf(geometry).map((rings) => rings.map((ring) => openRing(ring).map(([lng, lat]) => [lng, lat])));
}

// Planar area in local metres; within a single roof the error is far below a square metre.
function ringAreaM2(ring) {
  if (ring.length < 3) return 0;
  const perLng = metresPerLng(ring[0][1]);
  let twice = 0;
  for (let index = 0; index < ring.length; index += 1) {
    const [x1, y1] = ring[index];
    const [x2, y2] = ring[(index + 1) % ring.length];
    twice += x1 * perLng * (y2 * METRES_PER_LAT) - x2 * perLng * (y1 * METRES_PER_LAT);
  }
  return Math.abs(twice) / 2;
}

export function geometryAreaM2(geometry) {
  return fromGeometry(geometry).reduce(
    (sum, [outer, ...holes]) => sum + ringAreaM2(outer) - holes.reduce((total, hole) => total + ringAreaM2(hole), 0),
    0,
  );
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// The point on segment ab closest to p, all in screen pixels.
function closestOnSegment(p, a, b) {
  const [dx, dy] = [b.x - a.x, b.y - a.y];
  const length = dx * dx + dy * dy;
  const t = length === 0 ? 0 : Math.min(Math.max(((p.x - a.x) * dx + (p.y - a.y) * dy) / length, 0), 1);
  return { x: a.x + t * dx, y: a.y + t * dy };
}

function isTyping(event) {
  return ["INPUT", "TEXTAREA", "SELECT"].includes(event.target?.tagName) || event.target?.isContentEditable;
}

export class RoofEditor {
  // callbacks() returns the latest { onFinish(geometry), onCancel(), onChange(geometry),
  // onDone(), onDraft({ vertices, areaM2 }) } from the React component.
  constructor(map, callbacks) {
    this.map = map;
    this.callbacks = callbacks;
    this.mode = "off";
    this.polygons = [];
    this.cursor = null;
    this.snap = null;
    this.drag = null;
    this.lastReport = null;
    for (const name of ["onClick", "onDblClick", "onMove", "onDown", "onUp", "onContextMenu", "onKey"]) {
      this[name] = this[name].bind(this);
    }
  }

  start(mode, geometry) {
    this.stop();
    this.mode = mode;
    this.polygons = mode === "edit" ? fromGeometry(geometry) : [[[]]];
    const { map } = this;
    map.doubleClickZoom.disable();
    for (const [type, handler] of MAP_EVENTS) map.on(type, this[handler]);
    document.addEventListener("keydown", this.onKey);
    map.getCanvas().style.cursor = mode === "draw" ? "crosshair" : "";
    this.render();
  }

  stop() {
    if (this.mode === "off") return;
    const { map } = this;
    for (const [type, handler] of MAP_EVENTS) map.off(type, this[handler]);
    document.removeEventListener("keydown", this.onKey);
    map.doubleClickZoom.enable();
    map.getCanvas().style.cursor = "";
    if (this.drag) map.dragPan.enable();
    Object.assign(this, { mode: "off", polygons: [], cursor: null, snap: null, drag: null, lastReport: null });
    map.getSource("draft")?.setData(EMPTY);
  }

  get drawnRing() {
    return this.polygons[0][0];
  }

  canFinish() {
    return this.mode === "draw" && this.drawnRing.length >= 3;
  }

  finish() {
    if (!this.canFinish()) return;
    const geometry = toGeometry(this.polygons);
    this.stop();
    this.callbacks().onFinish(geometry);
  }

  cancel() {
    this.stop();
    this.callbacks().onCancel();
  }

  undo() {
    if (this.mode !== "draw" || this.drawnRing.length === 0) return;
    this.drawnRing.pop();
    this.render();
  }

  // The pointer position, pulled onto a nearby corner or edge of a building (or a corner of
  // this outline) so a roof can be traced exactly. Holding Alt turns snapping off.
  snapAt(event, skip) {
    const pointer = event.point;
    const free = { lngLat: [event.lngLat.lng, event.lngLat.lat], kind: null };
    if (event.originalEvent?.altKey) return free;

    const { map } = this;
    const box = [
      [pointer.x - SNAP_PX, pointer.y - SNAP_PX],
      [pointer.x + SNAP_PX, pointer.y + SNAP_PX],
    ];
    const buildingRings = map.getLayer("buildings-fill")
      ? map
          .queryRenderedFeatures(box, { layers: ["buildings-fill"] })
          .flatMap((feature) => polygonsOf(feature.geometry).flat())
      : [];
    const ownCorners = this.polygons.flatMap((rings, p) =>
      rings.flatMap((ring, r) => ring.filter((_, v) => !(skip && skip.p === p && skip.r === r && skip.v === v))),
    );

    let best = null;
    for (const corner of [...ownCorners, ...buildingRings.flat()]) {
      const gap = distance(map.project(corner), pointer);
      if (gap <= SNAP_PX && (!best || gap < best.gap)) best = { gap, lngLat: [corner[0], corner[1]], kind: "corner" };
    }
    if (best) return best;

    for (const ring of buildingRings) {
      for (let index = 0; index < ring.length - 1; index += 1) {
        const onEdge = closestOnSegment(pointer, map.project(ring[index]), map.project(ring[index + 1]));
        const gap = distance(onEdge, pointer);
        if (gap <= SNAP_PX && (!best || gap < best.gap)) {
          const lngLat = map.unproject([onEdge.x, onEdge.y]);
          best = { gap, lngLat: [lngLat.lng, lngLat.lat], kind: "edge" };
        }
      }
    }
    return best || free;
  }

  handleAt(pointer) {
    const box = [
      [pointer.x - HANDLE_PX, pointer.y - HANDLE_PX],
      [pointer.x + HANDLE_PX, pointer.y + HANDLE_PX],
    ];
    const hits = this.map.queryRenderedFeatures(box, { layers: ["draft-vertex", "draft-midpoint"] });
    return (hits.find((hit) => hit.properties.kind === "vertex") || hits[0])?.properties || null;
  }

  onClick(event) {
    if (this.mode !== "draw") return;
    const ring = this.drawnRing;
    if (ring.length >= 3 && distance(this.map.project(ring[0]), event.point) <= CLOSE_PX) {
      this.finish();
      return;
    }
    // The two clicks of a double-click land on the same spot; keep one corner.
    if (ring.length > 0 && distance(this.map.project(ring[ring.length - 1]), event.point) <= DUPLICATE_PX) return;
    ring.push(this.snapAt(event).lngLat);
    this.render();
  }

  onDblClick(event) {
    event.preventDefault();
    if (this.mode === "draw") this.finish();
    else if (this.mode === "edit") this.removeVertexAt(event.point);
  }

  onContextMenu(event) {
    if (this.mode === "edit") this.removeVertexAt(event.point);
  }

  removeVertexAt(pointer) {
    const hit = this.handleAt(pointer);
    if (hit?.kind !== "vertex") return;
    const ring = this.polygons[hit.p][hit.r];
    if (ring.length <= 3) return;
    ring.splice(hit.v, 1);
    this.render();
    this.callbacks().onChange(toGeometry(this.polygons));
  }

  onDown(event) {
    if (this.mode !== "edit") return;
    if (event.originalEvent?.touches && event.originalEvent.touches.length > 1) return;
    if (event.originalEvent?.button > 0) return;
    const hit = this.handleAt(event.point);
    if (!hit) return;
    // Stops the map from panning while a corner is dragged.
    event.preventDefault();
    this.map.dragPan.disable();
    const ring = this.polygons[hit.p][hit.r];
    if (hit.kind === "mid") {
      ring.splice(hit.v + 1, 0, [event.lngLat.lng, event.lngLat.lat]);
      this.drag = { p: hit.p, r: hit.r, v: hit.v + 1 };
    } else {
      this.drag = { p: hit.p, r: hit.r, v: hit.v };
    }
    this.render();
  }

  onMove(event) {
    if (this.mode === "draw") {
      this.cursor = this.snapAt(event);
      this.snap = this.cursor.kind ? this.cursor : null;
      this.render();
    } else if (this.drag) {
      const { p, r, v } = this.drag;
      const snapped = this.snapAt(event, this.drag);
      this.polygons[p][r][v] = snapped.lngLat;
      this.snap = snapped.kind ? snapped : null;
      this.render();
    } else if (event.type === "mousemove") {
      const hit = this.handleAt(event.point);
      this.map.getCanvas().style.cursor = hit ? (hit.kind === "vertex" ? "move" : "copy") : "";
    }
  }

  onUp() {
    if (!this.drag) return;
    this.drag = null;
    this.snap = null;
    this.map.dragPan.enable();
    this.render();
    this.callbacks().onChange(toGeometry(this.polygons));
  }

  onKey(event) {
    if (isTyping(event)) return;
    if (this.mode === "draw") {
      if (event.key === "Escape") this.cancel();
      else if (event.key === "Enter") this.finish();
      else if (event.key === "Backspace" || event.key === "Delete") {
        event.preventDefault();
        this.undo();
      }
    } else if (this.mode === "edit" && (event.key === "Escape" || event.key === "Enter")) {
      this.callbacks().onDone();
    }
  }

  render() {
    const features = [];
    let areaM2 = 0;
    let vertices = 0;

    if (this.mode === "draw") {
      const ring = this.drawnRing;
      const path = this.cursor ? [...ring, this.cursor.lngLat] : ring;
      if (path.length >= 3)
        features.push({
          type: "Feature",
          geometry: { type: "Polygon", coordinates: [closeRing(path)] },
          properties: {},
        });
      if (path.length >= 2)
        features.push({ type: "Feature", geometry: { type: "LineString", coordinates: path }, properties: {} });
      ring.forEach((corner, v) => features.push(point(corner, { kind: "vertex", first: v === 0 && ring.length >= 3 })));
      areaM2 = ringAreaM2(path);
      vertices = ring.length;
    } else if (this.mode === "edit") {
      const geometry = toGeometry(this.polygons);
      features.push({ type: "Feature", geometry, properties: {} });
      this.polygons.forEach((rings, p) =>
        rings.forEach((ring, r) =>
          ring.forEach((corner, v) => {
            const next = ring[(v + 1) % ring.length];
            features.push(point(corner, { kind: "vertex", p, r, v }));
            features.push(point([(corner[0] + next[0]) / 2, (corner[1] + next[1]) / 2], { kind: "mid", p, r, v }));
          }),
        ),
      );
      areaM2 = geometryAreaM2(geometry);
      vertices = this.polygons.reduce((sum, rings) => sum + rings.reduce((total, ring) => total + ring.length, 0), 0);
    }
    if (this.snap) features.push(point(this.snap.lngLat, { kind: "snap" }));
    this.map.getSource("draft")?.setData({ type: "FeatureCollection", features });

    const report = `${vertices}:${Math.round(areaM2)}`;
    if (report !== this.lastReport) {
      this.lastReport = report;
      this.callbacks().onDraft({ vertices, areaM2 });
    }
  }
}
