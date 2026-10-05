import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveChartData,
  buildChartOption,
  createChartConfig,
  parseChartConfig,
} from "../dist/contexts/reporting/chart-config.js";

const indicators = [
  { code: "IND-1", name: "Sessions delivered", baseline: "10", target: "30", unit: "sessions", achievement: "25", status: "VERIFIED" },
  { code: "IND-2", name: "People reached", baseline: "100", target: "500", unit: "people", achievement: "420", status: "VERIFIED" },
  { code: "IND-3", name: "Referral rate", baseline: "5", target: "10", unit: "%", achievement: "", status: "NEEDS_REVIEW" },
];

test("resolveChartData builds INDICATOR_COMPARISON series (units differ, so % of target; IND-3 has no value and is left out)", () => {
  const data = resolveChartData(indicators, createChartConfig({ type: "BAR", dataBinding: "INDICATOR_COMPARISON" }));
  assert.deepEqual(data.categories, ["IND-1", "IND-2"]);
  assert.equal(data.series.length, 2);
  assert.equal(data.series[0].name, "Baseline (% of target)");
  assert.equal(data.series[1].name, "Achievement (% of target)");
  assert.deepEqual(data.series[1].data, [83.3, 84]);
  assert.equal(data.unit, "%");
});

test("a single unit keeps the raw baseline / target / achievement", () => {
  const same = indicators.slice(0, 1).concat({ ...indicators[1], unit: "sessions" });
  const data = resolveChartData(same, createChartConfig({ type: "BAR", dataBinding: "INDICATOR_COMPARISON" }));
  assert.deepEqual(data.series.map((s) => s.name), ["Baseline", "Target", "Achievement"]);
  assert.deepEqual(data.series[2].data, [25, 420]);
  assert.equal(data.unit, "sessions");
});

test("resolveChartData builds STATUS_DISTRIBUTION counts", () => {
  const data = resolveChartData(indicators, createChartConfig({ type: "PIE", dataBinding: "STATUS_DISTRIBUTION" }));
  assert.equal(data.categories.includes("VERIFIED"), true);
  assert.equal(data.categories.includes("NEEDS REVIEW"), true);
  const verified = data.series.find((s) => s.name === "VERIFIED");
  assert.ok(verified);
  assert.equal(verified.data[0], 2);
});

test("buildChartOption draws each type the binding allows, and coerces the rest to a bar", () => {
  const draw = (type, dataBinding) => buildChartOption(indicators, createChartConfig({ type, dataBinding })).series[0].type;
  assert.equal(draw("BAR", "INDICATOR_PROGRESS"), "bar");
  assert.equal(draw("RADAR", "INDICATOR_PROGRESS"), "radar");
  assert.equal(draw("GAUGE", "INDICATOR_PROGRESS"), "bar", "two indicators: a gauge would show only one");
  assert.equal(draw("PIE", "STATUS_DISTRIBUTION"), "pie");
  for (const type of ["LINE", "AREA", "PIE", "RADAR", "GAUGE"]) assert.equal(draw(type, "INDICATOR_COMPARISON"), "bar", `${type} over indicator comparison`);
  const one = buildChartOption(indicators.slice(0, 1), createChartConfig({ type: "GAUGE", dataBinding: "INDICATOR_PROGRESS" }));
  assert.equal(one.series[0].type, "gauge");
});

test("parseChartConfig round-trips and rejects invalid input", () => {
  const cfg = createChartConfig({ type: "LINE", dataBinding: "INDICATOR_ACHIEVEMENT" });
  assert.deepEqual(parseChartConfig(JSON.stringify(cfg)), cfg);
  assert.equal(parseChartConfig(null), null);
  assert.equal(parseChartConfig("not json"), null);
  assert.equal(parseChartConfig(JSON.stringify({ type: "HISTOGRAM", dataBinding: "INDICATOR_ACHIEVEMENT" })), null);
});
