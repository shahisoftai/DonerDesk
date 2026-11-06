import test from "node:test";
import assert from "node:assert/strict";
import { METRICS, METRIC_KEYS, computeMetric, planCounts, scaleMoney, validateMetricQuery } from "../dist/index.js";

const usd = (minor) => ({ minor, currency: "USD" });
const eur = (minor) => ({ minor, currency: "EUR" });
const row = (id, status, signal = "ON_TIME", kind = "ACTIVITY") => ({ id, title: id, kind, start: "2026-01-01", end: "2026-02-01", status, signal, signalLabel: "" });
const fin = (over = {}) => ({
  primaryCurrency: "USD",
  index: { obligated: [usd(9110000)], disbursed: [usd(4770000)], remaining: [usd(4340000)], spent: [usd(1180000)], otherFunding: [] },
  inPrimary: { obligated: { total: usd(9110000), needsRate: [] }, disbursed: { total: usd(4770000), needsRate: [] }, spent: { total: usd(1180000), needsRate: [] } },
  ...over,
});

test("money is scaled to a short figure with its magnitude word, as on a management dashboard", () => {
  assert.deepEqual(scaleMoney(91100), { text: "91.1", scale: "thousand" });
  assert.deepEqual(scaleMoney(11800), { text: "11.8", scale: "thousand" });
  assert.deepEqual(scaleMoney(2500000), { text: "2.5", scale: "million" });
  assert.deepEqual(scaleMoney(4_200_000_000), { text: "4.2", scale: "billion" });
  assert.deepEqual(scaleMoney(950.5), { text: "950.5", scale: "" });
  assert.deepEqual(scaleMoney(50000), { text: "50", scale: "thousand" });
});

test("a finance tile reads the figure in its currency and names the unit", () => {
  const t = computeMetric({ metric: "FIN_OBLIGATED" }, { finance: fin() });
  assert.deepEqual([t.value, t.text, t.unit, t.color, t.title], [91100, "91.1", "thousand USD", "GREEN", "Obligated"]);
  assert.equal(computeMetric({ metric: "FIN_SPENT", color: "ORANGE", title: "Disbursed so far" }, { finance: fin() }).title, "Disbursed so far");
  assert.equal(computeMetric({ metric: "FIN_REMAINING" }, { finance: fin() }).text, "43.4");
});

test("with several currencies the reporting-currency tile needs rates for every amount, and a named currency is read on its own", () => {
  const mixed = fin({ index: { obligated: [usd(1000000), eur(500000)], disbursed: [], remaining: [usd(1000000), eur(500000)], spent: [], otherFunding: [] }, inPrimary: { obligated: { total: null, needsRate: [{}] }, disbursed: { total: null, needsRate: [] }, spent: { total: null, needsRate: [] } } });
  const t = computeMetric({ metric: "FIN_OBLIGATED" }, { finance: mixed });
  assert.deepEqual([t.value, t.note], [null, "Rate needed"]);
  assert.equal(computeMetric({ metric: "FIN_OBLIGATED", currency: "eur" }, { finance: mixed }).text, "5");
  assert.equal(computeMetric({ metric: "FIN_REMAINING" }, { finance: mixed }).note, "Rate needed");
  const converted = fin({ index: mixed.index, inPrimary: { obligated: { total: usd(2000000), needsRate: [] }, disbursed: { total: usd(500000), needsRate: [] }, spent: { total: null, needsRate: [] } } });
  assert.equal(computeMetric({ metric: "FIN_REMAINING" }, { finance: converted }).value, 15000);
});

test("nothing recorded is 'not recorded', never 0", () => {
  const empty = { primaryCurrency: "USD", index: { obligated: [], disbursed: [], remaining: [], spent: [], otherFunding: [] }, inPrimary: { obligated: { total: null, needsRate: [] }, disbursed: { total: null, needsRate: [] }, spent: { total: null, needsRate: [] } } };
  const t = computeMetric({ metric: "FIN_RECEIVED" }, { finance: empty });
  assert.deepEqual([t.value, t.text, t.note], [null, "", "Not recorded yet"]);
  assert.equal(computeMetric({ metric: "FIN_SPENT", currency: "KES" }, { finance: fin() }).note, "None in KES");
  assert.equal(computeMetric({ metric: "FIN_SPENT" }, {}).note, "Not available here");
});

test("activity tiles and the status donut share one count: milestones are not activities, cancelled ones are counted apart", () => {
  const plan = [row("a", "DONE", "DONE"), row("b", "IN_PROGRESS"), row("c", "PLANNED", "LATE"), row("d", "CANCELLED", "CANCELLED"), row("m", "PLANNED", "ON_TIME", "MILESTONE")];
  assert.deepEqual(planCounts(plan), { total: 3, planned: 1, inProgress: 1, done: 1, cancelled: 1, late: 1 });
  const t = computeMetric({ metric: "ACTIVITIES_TOTAL" }, { plan });
  assert.deepEqual([t.value, t.text, t.unit], [3, "3", "activities"]);
  assert.equal(computeMetric({ metric: "ACTIVITIES_LATE" }, { plan }).unit, "activity");
  assert.equal(computeMetric({ metric: "ACTIVITIES_DONE" }, { plan: [row("a", "PLANNED")] }).value, 0);
  assert.equal(computeMetric({ metric: "ACTIVITIES_TOTAL" }, { plan: [] }).note, "No plan yet");
  assert.equal(computeMetric({ metric: "ACTIVITIES_TOTAL" }, {}).note, "Not available here");
});

test("a tile's query is checked: known metric and colour, a currency only on money", () => {
  assert.equal(validateMetricQuery({ metric: "FIN_SPENT", currency: "USD", color: "RED" }), null);
  assert.ok(validateMetricQuery({ metric: "NOPE" }));
  assert.ok(validateMetricQuery({ metric: "FIN_SPENT", color: "PINK" }));
  assert.ok(validateMetricQuery({ metric: "ACTIVITIES_DONE", currency: "USD" }));
  assert.ok(validateMetricQuery({ metric: "FIN_SPENT", currency: "DOLLARS" }));
  assert.ok(validateMetricQuery({ metric: "FIN_SPENT", title: "x".repeat(61) }));
  assert.equal(METRIC_KEYS.length, Object.keys(METRICS).length);
});

import { MAP_VIEWS, MAP_VIEW_LABEL, validateMapWidget, widgetProblems } from "../dist/index.js";
test("a map widget stores only what it shows; an unknown view or a long name is refused; a map widget needs its settings", () => {
  assert.deepEqual([...MAP_VIEWS], ["RESULTS", "ACTIVITIES"]);
  assert.equal(validateMapWidget({ view: "RESULTS" }), null);
  assert.ok(validateMapWidget({ view: "SATELLITE" }));
  assert.ok(validateMapWidget({ view: "RESULTS", title: "x".repeat(61) }));
  assert.equal(MAP_VIEW_LABEL.ACTIVITIES, "Where activities are");
  const w = { id: "m", projectId: "p", kind: "MAP", map: { view: "ACTIVITIES" }, x: 0, y: 0, w: 6, h: 6 };
  assert.equal(widgetProblems([w]).length, 0);
  assert.equal(widgetProblems([{ ...w, map: undefined }]).length, 1);
});

import { buildKpi, updateWidgetSettings, validateKpiQuery } from "../dist/index.js";
const widgets3 = [
  { id: "t", projectId: "p", kind: "METRIC", metric: { metric: "FIN_SPENT", color: "ORANGE" }, tab: "Money", x: 0, y: 0, w: 3, h: 3 },
  { id: "m", projectId: "p", kind: "MAP", map: { view: "RESULTS" }, x: 0, y: 3, w: 12, h: 8 },
  { id: "k", projectId: "p", kind: "KPI", kpi: { indicatorId: "a", includeDraft: true }, x: 3, y: 0, w: 3, h: 3 },
  { id: "x", projectId: "p", kind: "TEXT", text: "old", x: 6, y: 0, w: 3, h: 3 },
  { id: "c", projectId: "p", spec: { version: 2, kind: "BAR", title: "Old title", dataset: { template: "INDICATOR_OVER_TIME", indicatorIds: ["a"] } }, x: 0, y: 11, w: 6, h: 4 },
];
test("a widget's settings change in place: its spot, size, tab and project stay; a change for another kind is refused", () => {
  const a = updateWidgetSettings(widgets3, "t", { kind: "METRIC", metric: { metric: "FIN_RECEIVED", color: "BLUE", title: "In" } });
  assert.deepEqual(a[0].metric, { metric: "FIN_RECEIVED", color: "BLUE", title: "In" });
  assert.deepEqual([a[0].x, a[0].y, a[0].w, a[0].h, a[0].tab, a[0].projectId], [0, 0, 3, 3, "Money", "p"]);
  assert.deepEqual(widgets3[0].metric, { metric: "FIN_SPENT", color: "ORANGE" }, "the original is not changed");
  assert.equal(updateWidgetSettings(widgets3, "m", { kind: "MAP", map: { view: "ACTIVITIES", title: "Sites" } })[1].map.view, "ACTIVITIES");
  assert.equal(updateWidgetSettings(widgets3, "x", { kind: "TEXT", text: "new" })[3].text, "new");
  assert.equal(updateWidgetSettings(widgets3, "k", { kind: "KPI", kpi: { indicatorId: "a", includeDraft: false, color: "GREEN" } })[2].kpi.color, "GREEN");
  assert.equal(updateWidgetSettings(widgets3, "t", { kind: "MAP", map: { view: "RESULTS" } }), null, "a number tile is not a map");
  assert.equal(updateWidgetSettings(widgets3, "nope", { kind: "TEXT", text: "x" }), null);
});
test("a chart can be renamed or have its name cleared without touching its data", () => {
  const renamed = updateWidgetSettings(widgets3, "c", { kind: "CHART", title: "  Reach by month " });
  assert.equal(renamed[4].spec.title, "Reach by month");
  assert.deepEqual(renamed[4].spec.dataset, widgets3[4].spec.dataset);
  assert.equal("title" in updateWidgetSettings(widgets3, "c", { kind: "CHART", title: " " })[4].spec, false);
  assert.equal(updateWidgetSettings(widgets3, "x", { kind: "CHART", title: "a" }), null);
});
test("a KPI tile may be coloured and named, and is checked", () => {
  assert.equal(validateKpiQuery({ indicatorId: "a", includeDraft: true, color: "PURPLE", title: "People reached" }), null);
  assert.ok(validateKpiQuery({ indicatorId: "a", includeDraft: true, color: "PINK" }));
  assert.ok(validateKpiQuery({ indicatorId: "", includeDraft: true }));
  assert.ok(validateKpiQuery({ indicatorId: "a", includeDraft: true, title: "x".repeat(61) }));
  const sheet = { projectId: "x", periods: [{ id: "p1", label: "Jan", start: "2026-01-01", end: "2026-01-28", reportType: "MONTHLY", locked: false }], indicators: [{ id: "a", code: "A", name: "People", level: "OUTPUT", type: "COUNT", unit: "people", baseline: "0", target: "100", isRate: false }], cells: [{ indicatorId: "a", periodId: "p1", periodValue: "10", cumulativeValue: "10", status: "VERIFIED" }], finance: [] };
  const t = buildKpi(sheet, { indicatorId: "a", includeDraft: true, color: "GREEN", title: "Reached" }).tile;
  assert.deepEqual([t.title, t.color], ["Reached", "GREEN"]);
  assert.deepEqual([buildKpi(sheet, { indicatorId: "a", includeDraft: true }).tile.title, buildKpi(sheet, { indicatorId: "a", includeDraft: true }).tile.color], ["A People", null]);
});
