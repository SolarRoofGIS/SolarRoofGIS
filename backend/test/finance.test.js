const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { estimateFinance, powerById, FINANCE } = require("../finance");
const { panelById } = require("../solar");

const base = { maxPanels: 30, pvout: 1200, panel: panelById("550") };

test("the recommendation never exceeds the connected power", () => {
  const result = estimateFinance({ ...base, monthlyBillRp: 500000, power: powerById("1300") });
  assert.equal(result.recommendation.limitedBy, "power");
  assert.ok(result.recommendation.capacityKwp <= 1.3);
  assert.equal(result.panelCount, result.recommendation.panelCount);
});

test("a low use limits the recommendation", () => {
  // Rp400.000 at Rp1.699,53 ≈ 235 kWh/month ≈ 2.824 kWh/year ≈ 4 panels of 550 Wp at 1.200.
  const result = estimateFinance({ ...base, monthlyBillRp: 400000, power: powerById("3500") });
  assert.equal(result.recommendation.limitedBy, "use");
  assert.equal(result.recommendation.panelCount, 4);
  assert.ok(result.annualKwh <= result.monthlyUseKwh * 12);
});

test("a large home is limited by the roof", () => {
  const result = estimateFinance({ ...base, maxPanels: 6, monthlyBillRp: 5000000, power: powerById("16500") });
  assert.equal(result.recommendation.limitedBy, "roof");
  assert.equal(result.recommendation.panelCount, 6);
});

test("a subsidised 450 VA home is flagged as below the minimum", () => {
  const result = estimateFinance({ ...base, monthlyBillRp: 100000, power: powerById("450") });
  assert.equal(result.recommendation.belowMinimum, true);
});

test("savings never exceed the bill, and payback is cost over yearly savings", () => {
  const result = estimateFinance({ ...base, panelCount: 20, monthlyBillRp: 300000, power: powerById("2200") });
  assert.equal(result.monthlySavingRp, 300000);
  assert.equal(result.limitedByBill, true);
  assert.equal(result.paybackYears, Math.round((result.investmentRp / (300000 * 12)) * 10) / 10);
  assert.equal(result.investmentRp, Math.round(result.capacityKwp * FINANCE.costRpPerKwp));
});

test("without a bill, savings stop at what the connected power can use", () => {
  const power = powerById("1300");
  const result = estimateFinance({ ...base, maxPanels: 243, panelCount: 243, monthlyBillRp: null, power });
  const usable = Math.round(((1.3 * base.pvout) / 12) * power.tariffRpPerKwh);
  assert.equal(result.monthlySavingRp, usable);
  assert.equal(result.limitedByPower, true);
  assert.equal(result.limitedByBill, false);
  assert.ok(result.monthlySavingRp < result.monthlyProductionRp);
});

test("a system within the connected power keeps its full savings", () => {
  const result = estimateFinance({ ...base, panelCount: 2, monthlyBillRp: null, power: powerById("1300") });
  assert.equal(result.monthlySavingRp, result.monthlyProductionRp);
  assert.equal(result.limitedByPower, false);
});

test("polycrystalline panels give less capacity on the same roof", () => {
  const mono = estimateFinance({ ...base, panelCount: 10, monthlyBillRp: null });
  const poly = estimateFinance({ ...base, panelCount: 10, monthlyBillRp: null, panelType: "poly" });
  assert.ok(poly.capacityKwp < mono.capacityKwp);
  assert.equal(poly.projection, null);
});

test("spending beyond what the connection can deliver is flagged", () => {
  assert.equal(estimateFinance({ ...base, monthlyBillRp: 5000000, power: powerById("900s") }).billAbovePower, true);
});

test("POST /api/finance/estimate validates its input", async (t) => {
  const app = express();
  app.use(express.json());
  app.use("/api/finance", require("../routes/finance"));
  const server = app.listen(0);
  t.after(() => server.close());
  const url = `http://127.0.0.1:${server.address().port}/api/finance/estimate`;
  const post = async (body) => {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  };

  const ok = await post({ maxPanels: 20, pvout: 1200, monthlyBillRp: 500000, power: "1300" });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.finance.panelCount, ok.body.finance.recommendation.panelCount);
  for (const bad of [
    { pvout: 1200, panelCount: 0 },
    { pvout: 1200, panelCount: "5" },
    { pvout: -1 },
    { pvout: 1200, power: "999" },
    { pvout: 1200, panel: "999" },
    { pvout: 1200, maxPanels: 0 },
    { pvout: 1200, monthlyBillRp: -5 },
  ]) {
    assert.equal((await post(bad)).status, 400, JSON.stringify(bad));
  }
});
