import assert from "node:assert/strict";
import test from "node:test";
import { periodSheetLabel, indicatorSheetRows, pivotSheet, toCsv, parseCsv, previewDataSheetImport, buildDataChart } from "../dist/index.js";

const periods = [
  { id: "p1", label: "Jan 2026", start: "2026-01-01", end: "2026-01-31", reportType: "MONTHLY", locked: false },
  { id: "p2", label: "Feb 2026", start: "2026-02-01", end: "2026-02-28", reportType: "MONTHLY", locked: false },
  { id: "p3", label: "Mar 2026", start: "2026-03-01", end: "2026-03-31", reportType: "MONTHLY", locked: true },
];
const ind = (id, code, extra = {}) => ({ id, code, name: code, level: "OUTPUT", type: "COUNT", unit: "people", baseline: "0", target: "100", isRate: false, ...extra });
const sheet = {
  projectId: "x",
  periods,
  indicators: [ind("i1", "OUT-1"), ind("i2", "OUT-2", { unit: "kits" }), ind("i3", "RATE-1", { type: "PERCENTAGE", unit: "%", isRate: true })],
  cells: [
    { indicatorId: "i1", periodId: "p1", periodValue: "10", cumulativeValue: "10", status: "VERIFIED" },
    { indicatorId: "i1", periodId: "p2", periodValue: "15", cumulativeValue: "25", status: "DRAFT" },
    { indicatorId: "i2", periodId: "p1", periodValue: "5", cumulativeValue: "5", status: "DRAFT" },
  ],
  finance: [
    { periodId: "p1", currency: "USD", budget: "1000", expenditure: "250", balance: "750", burnRatePercent: "25.0", verified: true },
  ],
};

test("a calendar month is labelled by month, anything else by its dates", () => {
  assert.equal(periodSheetLabel("2026-01-01", "2026-01-31"), "Jan 2026");
  assert.equal(periodSheetLabel("2026-01-05", "2026-02-10"), "5 Jan 2026 – 10 Feb 2026");
});

test("the long sheet has a row per indicator per period and leaves unrecorded values empty, never 0", () => {
  const rows = indicatorSheetRows(sheet);
  assert.equal(rows.length, 9);
  const blank = rows.find((r) => r[0] === "OUT-1" && r[7] === "Mar 2026");
  assert.equal(blank[10], "");
  assert.equal(blank[12], "");
  const feb = rows.find((r) => r[0] === "OUT-1" && r[7] === "Feb 2026");
  assert.equal(feb[12], "25%");
});

test("a rate has no % of target in the sheet", () => {
  const sheetWithRate = { ...sheet, cells: [...sheet.cells, { indicatorId: "i3", periodId: "p1", periodValue: "40", cumulativeValue: "", status: "DRAFT" }] };
  const row = indicatorSheetRows(sheetWithRate).find((r) => r[0] === "RATE-1" && r[7] === "Jan 2026");
  assert.equal(row[12], "");
});

test("the pivot puts periods across the top", () => {
  const p = pivotSheet(sheet, "CUMULATIVE");
  assert.deepEqual(p.headers.slice(5), ["Jan 2026", "Feb 2026", "Mar 2026"]);
  assert.deepEqual(p.rows[0].slice(5), ["10", "25", ""]);
});

test("CSV round-trips quotes, commas and newlines, and a formula-like text cell stays text", () => {
  const csv = toCsv([["a", 'b,"c"', "line\nbreak"], ["=SUM(A1)", "-5", "1,200"]]);
  assert.match(csv, /'=SUM\(A1\)/);
  const back = parseCsv(csv);
  assert.equal(back[0][1], 'b,"c"');
  assert.equal(back[0][2], "line\nbreak");
  assert.equal(back[1][1], "-5");
  assert.equal(parseCsv("﻿a;b\r\n1;2")[1][1], "2");
});

const header = "Indicator code,Period,Period value,Cumulative value,Comments";

test("import: changed, unchanged and refused rows are told apart; empty cells never clear a value", () => {
  const table = parseCsv([
    header,
    "OUT-1,Jan 2026,10,10,",
    "OUT-1,Feb 2026,20,,note",
    "OUT-1,Mar 2026,5,5,",
    "NOPE-1,Jan 2026,1,1,",
    "OUT-2,Jan 2026,abc,,",
    "OUT-2,Apr 2026,1,1,",
    "OUT-2,Feb 2026,7,7,",
  ].join("\n"));
  const preview = previewDataSheetImport(sheet, table);
  assert.equal(preview.changed, 2);
  assert.equal(preview.unchanged, 1);
  assert.equal(preview.errors, 4);
  const feb = preview.rows[1];
  assert.equal(feb.periodValue, "20");
  assert.equal(feb.cumulativeValue, "25");
  assert.match(preview.rows[2].error, /closed/);
  assert.match(preview.rows[3].error, /No indicator/);
  assert.match(preview.rows[4].error, /not a number/);
  assert.match(preview.rows[5].error, /No reporting period/);
});

test("import: periods also match on their dates, and a file without the key columns is refused", () => {
  const dated = parseCsv("Indicator code,Period start,Period end,Period value\nOUT-1,2026-02-01,2026-02-28,16");
  assert.equal(previewDataSheetImport(sheet, dated).changed, 1);
  const missing = previewDataSheetImport(sheet, parseCsv("Name,Value\nx,1"));
  assert.ok(missing.missingColumns.length > 0);
});

const spec = (over) => ({ template: "INDICATOR_OVER_TIME", indicatorIds: ["i1"], measure: "PERIOD", type: "BAR", showTarget: false, ...over });

test("charts: one indicator over time leaves a gap (null) where nothing is recorded", () => {
  const r = buildDataChart(sheet, spec({}));
  assert.ok(r.ok);
  assert.deepEqual(r.option.series[0].data, [10, 15, null]);
});

test("charts: a template refuses a type that cannot show its data, and an empty selection", () => {
  assert.equal(buildDataChart(sheet, spec({ type: "PIE" })).ok, false);
  assert.equal(buildDataChart(sheet, spec({ indicatorIds: [] })).ok, false);
});

test("charts: indicators with different units are drawn as % of target, not on one raw axis", () => {
  const r = buildDataChart(sheet, spec({ template: "INDICATORS_OVER_TIME", indicatorIds: ["i1", "i2"], type: "LINE" }));
  assert.ok(r.ok);
  assert.ok(r.notes.some((n) => /different units/.test(n)));
  assert.deepEqual(r.option.series[0].data, [10, 25, null]);
});

test("charts: progress leaves out rates and says so", () => {
  const withRate = { ...sheet, cells: [...sheet.cells, { indicatorId: "i3", periodId: "p1", periodValue: "40", cumulativeValue: "", status: "DRAFT" }] };
  const r = buildDataChart(withRate, spec({ template: "INDICATORS_PROGRESS", indicatorIds: ["i1", "i3"] }));
  assert.ok(r.ok);
  assert.ok(r.notes.some((n) => /RATE-1/.test(n)));
});

test("charts: finance budget vs expenditure uses the recorded periods only and flags unverified figures", () => {
  const r = buildDataChart(sheet, { template: "FINANCE_BUDGET_VS_SPEND", indicatorIds: [], measure: "PERIOD", type: "BAR", showTarget: false });
  assert.ok(r.ok);
  assert.deepEqual(r.option.series.map((s) => s.data), [[1000], [250]]);
  const unverified = { ...sheet, finance: [{ ...sheet.finance[0], verified: false }] };
  assert.ok(buildDataChart(unverified, { template: "FINANCE_BURN_RATE", indicatorIds: [], measure: "PERIOD", type: "LINE", showTarget: false }).notes.length > 0);
});

test("charts: a gauge of one indicator against its target", () => {
  const r = buildDataChart(sheet, spec({ template: "INDICATOR_VS_TARGET", type: "GAUGE" }));
  assert.ok(r.ok);
  assert.equal(r.option.series[0].data[0].value, 25);
});

test("charts: a target line far above the data stretches the axis so it stays visible", () => {
  const r = buildDataChart(sheet, spec({ measure: "CUMULATIVE", type: "LINE", showTarget: true }));
  assert.ok(r.ok);
  assert.ok(r.option.yAxis.max >= 100);
});

test("charts: unverified values are plotted but counted and warned about", () => {
  const r = buildDataChart(sheet, spec({}));
  assert.ok(r.ok);
  assert.deepEqual(r.provenance, { points: 2, unverified: 1 });
  assert.ok(r.notes.some((n) => /1 of 2 plotted values/.test(n)));
  assert.equal(r.resolved.dataBinding, "DATA_CENTER");
});

test("charts: finance provenance counts unverified figures", () => {
  const unverified = { ...sheet, finance: [{ ...sheet.finance[0], verified: false }] };
  const r = buildDataChart(unverified, { template: "FINANCE_BUDGET_VS_SPEND", indicatorIds: [], measure: "PERIOD", type: "BAR", showTarget: false });
  assert.deepEqual(r.provenance, { points: 1, unverified: 1 });
});

test("charts: chosen colours are used per series, ignore anything that is not #rrggbb, and cycle if fewer than series", () => {
  const two = buildDataChart(sheet, spec({ template: "INDICATORS_OVER_TIME", indicatorIds: ["i1", "i2"], type: "BAR", measure: "PERCENT_OF_TARGET", colors: ["#112233", "#445566"] }));
  assert.ok(two.ok);
  assert.deepEqual(two.option.series.map((s) => s.itemStyle.color), ["#112233", "#445566"]);
  assert.deepEqual(two.resolved.colors, ["#112233", "#445566"]);
  const bad = buildDataChart(sheet, spec({ colors: ["red", "javascript:1", "#abc"] }));
  assert.ok(bad.ok);
  assert.equal(bad.resolved.colors, undefined);
  const one = buildDataChart(sheet, spec({ template: "INDICATORS_OVER_TIME", indicatorIds: ["i1", "i2"], type: "BAR", measure: "PERCENT_OF_TARGET", colors: ["#112233"] }));
  assert.deepEqual(one.option.series.map((s) => s.itemStyle.color), ["#112233", "#112233"]);
});

test("charts: a pie takes one colour per slice from the same list", () => {
  const r = buildDataChart(sheet, { template: "STATUS_DISTRIBUTION", indicatorIds: [], measure: "PERIOD", type: "PIE", showTarget: false, colors: ["#aa0000", "#00aa00"] });
  assert.ok(r.ok);
  assert.deepEqual(r.option.color, ["#aa0000", "#00aa00"]);
});
