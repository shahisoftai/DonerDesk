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

test("resolveChartData builds INDICATOR_COMPARISON series", () => {
  const data = resolveChartData(indicators, createChartConfig({ type: "BAR", dataBinding: "INDICATOR_COMPARISON" }));
  assert.deepEqual(data.categories, ["IND-1", "IND-2", "IND-3"]);
  assert.equal(data.series.length, 3);
  assert.equal(data.series[0].name, "Baseline");
  assert.equal(data.series[2].name, "Achievement");
  assert.deepEqual(data.series[2].data, [25, 420, null]);
});

test("resolveChartData builds STATUS_DISTRIBUTION counts", () => {
  const data = resolveChartData(indicators, createChartConfig({ type: "PIE", dataBinding: "STATUS_DISTRIBUTION" }));
  assert.equal(data.categories.includes("VERIFIED"), true);
  assert.equal(data.categories.includes("NEEDS REVIEW"), true);
  const verified = data.series.find((s) => s.name === "VERIFIED");
  assert.ok(verified);
  assert.equal(verified.data[0], 2);
});

test("buildChartOption emits an ECharts option for each type", () => {
  for (const type of ["BAR", "LINE", "PIE", "AREA", "RADAR", "GAUGE"]) {
    const option = buildChartOption(indicators, createChartConfig({ type, dataBinding: "INDICATOR_COMPARISON" }));
    assert.ok(option, `option for ${type}`);
    const series = option.series;
    assert.ok(Array.isArray(series) && series.length > 0, `series for ${type}`);
    const first = series[0];
    if (type === "GAUGE") {
      assert.equal(first.type, "gauge");
    } else if (type === "PIE") {
      assert.equal(first.type, "pie");
    } else if (type === "RADAR") {
      assert.equal(first.type, "radar");
    } else if (type === "LINE" || type === "AREA") {
      assert.equal(first.type, "line");
    } else {
      assert.equal(first.type, "bar");
    }
  }
});

test("parseChartConfig round-trips and rejects invalid input", () => {
  const cfg = createChartConfig({ type: "LINE", dataBinding: "INDICATOR_ACHIEVEMENT" });
  assert.deepEqual(parseChartConfig(JSON.stringify(cfg)), cfg);
  assert.equal(parseChartConfig(null), null);
  assert.equal(parseChartConfig("not json"), null);
  assert.equal(parseChartConfig(JSON.stringify({ type: "HISTOGRAM", dataBinding: "INDICATOR_ACHIEVEMENT" })), null);
});
