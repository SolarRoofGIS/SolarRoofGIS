const test = require("node:test");
const assert = require("node:assert/strict");
const { fitPanels } = require("../panelLayout");
const { PANELS, ASSUMPTIONS } = require("../solar");

const PANEL_550 = PANELS.find((panel) => panel.id === "550");
const GAP = ASSUMPTIONS.panelGapM;

function rectangle(width, height, angle = 0) {
  const [cos, sin] = [Math.cos(angle), Math.sin(angle)];
  const corners = [
    [0, 0],
    [width, 0],
    [width, height],
    [0, height],
  ].map(([x, y]) => [500000 + x * cos - y * sin, 9270000 + x * sin + y * cos]);
  return { type: "Polygon", coordinates: [[...corners, corners[0]]] };
}

// The four corners of a laid-out panel [x, y, angle of the long side].
function corners([x, y, angle], { widthM, lengthM }) {
  const along = [Math.cos(angle), Math.sin(angle)];
  const across = [-along[1], along[0]];
  return [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([a, b]) => [
    x + (a * lengthM * along[0]) / 2 + (b * widthM * across[0]) / 2,
    y + (a * lengthM * along[1]) / 2 + (b * widthM * across[1]) / 2,
  ]);
}

test("a 10 × 6 m roof holds 5 rows of 4 panels", () => {
  // Long side along 10 m: 4 per row (4 × 2.278 + 3 × 0.02 = 9.17 m), 5 rows of 1.134 m in 6 m.
  const { count, panels } = fitPanels(rectangle(10, 6), PANEL_550, GAP);
  assert.equal(count, 20);
  assert.equal(panels.length, 20);
});

test("a roof narrower than one panel holds none", () => {
  assert.equal(fitPanels(rectangle(1, 20), PANEL_550, GAP).count, 0);
});

test("a row that fits exactly is not lost to rounding", () => {
  // Exactly 2 panels wide along the short side: 2 × 1.134 + 0.02.
  const { count } = fitPanels(rectangle(2 * 1.134 + 0.02, 50), PANEL_550, GAP);
  assert.ok(count >= 2 * 21, `expected two columns of panels, got ${count}`);
});

test("the count does not depend on how the roof is turned", () => {
  const straight = fitPanels(rectangle(12, 7), PANEL_550, GAP).count;
  for (const degrees of [17, 45, 73]) {
    assert.equal(fitPanels(rectangle(12, 7, (degrees * Math.PI) / 180), PANEL_550, GAP).count, straight);
  }
});

test("panels stay inside the roof and never overlap", () => {
  const roof = rectangle(11.3, 8.7, 0.4);
  const ring = roof.coordinates[0];
  const inside = ([x, y]) => {
    let result = false;
    for (let i = 0, j = ring.length - 2; i < ring.length - 1; j = i, i += 1) {
      const [[xi, yi], [xj, yj]] = [ring[i], ring[j]];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) result = !result;
    }
    return result;
  };
  const { panels } = fitPanels(roof, PANEL_550, GAP);
  const boxes = panels.map((panel) => corners(panel, PANEL_550));
  for (const box of boxes) {
    // Shrunk by the fit tolerance, every corner is on the roof.
    const [cx, cy] = [box.reduce((sum, [x]) => sum + x, 0) / 4, box.reduce((sum, [, y]) => sum + y, 0) / 4];
    for (const [x, y] of box) assert.ok(inside([x + (cx - x) * 0.005, y + (cy - y) * 0.005]));
  }
  // Centres are at least one panel width apart, so no two panels share space.
  for (let i = 0; i < panels.length; i += 1) {
    for (let j = i + 1; j < panels.length; j += 1) {
      const distance = Math.hypot(panels[i][0] - panels[j][0], panels[i][1] - panels[j][1]);
      assert.ok(distance >= PANEL_550.widthM, `panels ${i} and ${j} overlap`);
    }
  }
});

test("a smaller system takes the panels in the middle first", () => {
  const { panels } = fitPanels(rectangle(10, 8), PANEL_550, GAP);
  const centre = [500005, 9270004];
  const distance = ([x, y]) => Math.hypot(x - centre[0], y - centre[1]);
  const firstFour = Math.max(...panels.slice(0, 4).map(distance));
  const lastFour = Math.min(...panels.slice(-4).map(distance));
  assert.ok(firstFour < lastFour);
});
