const test = require("node:test");
const assert = require("node:assert/strict");
const { estimateSolar, panelById, ASSUMPTIONS } = require("../solar");

const square = (side) => ({
  type: "Polygon",
  coordinates: [
    [
      [0, 0],
      [side, 0],
      [side, side],
      [0, side],
      [0, 0],
    ],
  ],
});

function estimate({ footprint = 100, side = 9, pvout = 1300, panel = panelById() } = {}) {
  return estimateSolar({
    footprintM2: footprint,
    setbackM2: side * side,
    setbackGeometry: square(side),
    pvout,
    monthlyPvout: Array(12).fill(pvout / 12),
    optimumTilt: 10,
    panel,
  });
}

test("energy is capacity times PVOUT", () => {
  const result = estimate();
  assert.ok(result.suitable);
  assert.equal(result.capacityKwp, (result.panelCount * 550) / 1000);
  assert.equal(result.annualKwh, Math.round(result.capacityKwp * 1300));
});

test("the area limit uses the packing factor and the panel area", () => {
  const result = estimate({ side: 9 });
  const usable = 81 * ASSUMPTIONS.packingFactor;
  assert.equal(result.usableM2, Math.round(usable * 10) / 10);
  assert.ok(result.panelCount <= Math.floor(usable / panelById("550").areaM2));
  assert.equal(result.layout.panels.length, result.panelCount);
});

test("a smaller panel fits more panels on the same roof", () => {
  assert.ok(estimate({ panel: panelById("430") }).panelCount > estimate({ panel: panelById("670") }).panelCount);
});

test("no PVOUT means no estimate", () => {
  const result = estimate({ pvout: null });
  assert.equal(result.suitable, false);
  assert.equal(result.annualKwh, 0);
  assert.deepEqual(result.layout.panels, []);
});

test("a roof for fewer than the minimum is unsuitable", () => {
  const result = estimate({ side: 2 });
  assert.equal(result.suitable, false);
  assert.equal(result.panelCount, 0);
});

test("unknown panel ids are rejected, empty means the default", () => {
  assert.equal(panelById("999"), null);
  assert.equal(panelById(undefined).id, ASSUMPTIONS.defaultPanel);
  assert.equal(panelById("").id, ASSUMPTIONS.defaultPanel);
});
