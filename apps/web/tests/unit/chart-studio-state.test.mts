import assert from "node:assert/strict";
import test from "node:test";
import {
  STUDIO_TEMPLATES, MAX_UNDO, initialSpec, startStudio, applyEdit, undo, redo, withTemplate, withKind, toggleIndicator, kindChoices, withSeriesStyle, withAxis,
  addAnnotation, updateAnnotation, removeAnnotation, withText, suggestedFix, dataTable, toCsv, fileNameFor,
} from "../../src/features/charts/domain/studio-state.ts";
import { CHART_KIND_ORDER, validateChartSpec } from "@donordesk/domain/contexts/reporting/chart-spec-v2.js";
import { CHART_KINDS } from "@donordesk/domain/contexts/reporting/chart-spec-v2.js";
import { LOCALES } from "../../src/features/i18n/domain/locales.ts";
import { MESSAGES } from "../../src/features/i18n/messages/index.ts";

const ALL = ["i1", "i2", "i3"];

test("the first chart is the first indicator over time, valid, with drafts shown", () => {
  const s = initialSpec(ALL);
  assert.deepEqual(validateChartSpec(s), []);
  assert.deepEqual(s.dataset.indicatorIds, ["i1"]);
  assert.equal(s.dataset.includeDraft, true);
  assert.deepEqual(initialSpec([]).dataset.indicatorIds, [], "no indicators yet");
});

test("the studio offers every data template, finance included", () => {
  assert.deepEqual([...STUDIO_TEMPLATES].sort(), ["ACTIVITY_DAYS", "BUDGET_FLOW", "FINANCE_BUDGET_VS_SPEND", "FINANCE_BURN_RATE", "INDICATORS_OVER_TIME", "INDICATORS_PROGRESS", "INDICATOR_OVER_TIME", "INDICATOR_VS_TARGET", "PLAN_TIMELINE", "RESULTS_BY_PLACE", "STATUS_DISTRIBUTION"]);
  const f = withTemplate(initialSpec(ALL), "FINANCE_BUDGET_VS_SPEND", ALL);
  assert.deepEqual(f.dataset.indicatorIds, [], "finance takes no indicators");
  assert.deepEqual(validateChartSpec(f), []);
});

test("every edit is one undo step; undo and redo restore exactly; a no-op is not a step; a new edit clears redo; history is capped", () => {
  let st = startStudio(initialSpec(ALL));
  const first = st.spec;
  st = applyEdit(st, withText(st.spec, "title", "Hello"));
  st = applyEdit(st, withText(st.spec, "title", "Hello"));
  assert.equal(st.past.length, 1, "typing the same thing is not a step");
  st = applyEdit(st, withText(st.spec, "subtitle", "Oct"));
  const full = st.spec;
  st = undo(st);
  assert.equal(st.spec.subtitle, undefined);
  assert.equal(st.spec.title, "Hello");
  st = redo(st);
  assert.deepEqual(st.spec, full);
  st = undo(undo(st));
  assert.deepEqual(st.spec, first);
  assert.deepEqual(undo(st), st, "nothing left to undo");
  st = applyEdit(st, withText(st.spec, "caption", "x"));
  assert.equal(st.future.length, 0);
  assert.deepEqual(redo(st), st);
  let many = startStudio(first);
  for (let i = 0; i < MAX_UNDO + 20; i += 1) many = applyEdit(many, withText(many.spec, "title", `t${i}`));
  assert.equal(many.past.length, MAX_UNDO);
});

test("choosing a template always leaves a valid spec: the indicator count and the kind are fixed up", () => {
  for (const from of STUDIO_TEMPLATES) {
    for (const to of STUDIO_TEMPLATES) {
      const s = withTemplate(withTemplate(initialSpec(ALL), from, ALL), to, ALL);
      assert.deepEqual(validateChartSpec(s), [], `${from} -> ${to}`);
    }
  }
  const progress = withTemplate(initialSpec(ALL), "INDICATORS_PROGRESS", ALL);
  assert.equal(progress.dataset.measure, "PERCENT_OF_TARGET", "progress is a share of target");
  assert.deepEqual(progress.dataset.indicatorIds, ["i1"], "the chosen indicator is kept");
  assert.deepEqual(withTemplate(initialSpec(ALL), "STATUS_DISTRIBUTION", ALL).dataset.indicatorIds, []);
  assert.equal(withTemplate(initialSpec(ALL), "INDICATOR_VS_TARGET", ALL).dataset.indicatorIds.length, 1);
  assert.equal(withTemplate({ ...initialSpec(ALL), kind: "LINE" }, "INDICATOR_VS_TARGET", ALL).kind, "BAR", "a line cannot show baseline, target and result; the nearest honest kind is chosen");
  assert.equal(withTemplate({ ...initialSpec(ALL), kind: "LINE" }, "INDICATORS_OVER_TIME", ALL).kind, "LINE", "a kind that still fits is kept");
});

test("a kind is chosen only if the data can be drawn as it", () => {
  const s = initialSpec(ALL);
  assert.equal(withKind(s, "LINE")?.kind, "LINE");
  assert.equal(withKind(s, "PIE"), null, "a time series is not parts of a whole");
  assert.equal(withKind(s, "SANKEY"), null, "a budget flow is not a time series");
  assert.equal(withKind(s, "CHOROPLETH"), null, "a map needs places, not a time series");
  assert.equal(withKind(s, "POPULATION_PYRAMID"), null, "not available yet");
  const choices = kindChoices(s);
  assert.equal(choices.find((c) => c.kind === "BAR")!.current, true);
  assert.equal(choices.find((c) => c.kind === "LINE")!.state, "OK");
  assert.equal(choices.find((c) => c.kind === "PIE")!.state, "NEEDS_OTHER_DATA");
  assert.equal(choices.find((c) => c.kind === "SANKEY")!.state, "NEEDS_OTHER_DATA");
  assert.equal(choices.find((c) => c.kind === "CHOROPLETH")!.state, "NEEDS_OTHER_DATA");
  assert.equal(choices.find((c) => c.kind === "POPULATION_PYRAMID")!.state, "PLANNED");
  assert.ok(choices.length >= 40);
});

test("indicators are added and removed; a one-indicator template replaces; a no-indicator template ignores", () => {
  const many = withTemplate(initialSpec(ALL), "INDICATORS_OVER_TIME", ALL);
  const two = toggleIndicator(many, "i2");
  assert.deepEqual(two.dataset.indicatorIds, ["i1", "i2"]);
  assert.deepEqual(toggleIndicator(two, "i1").dataset.indicatorIds, ["i2"]);
  assert.deepEqual(toggleIndicator(initialSpec(ALL), "i3").dataset.indicatorIds, ["i3"]);
  const status = withTemplate(initialSpec(ALL), "STATUS_DISTRIBUTION", ALL);
  assert.deepEqual(toggleIndicator(status, "i1"), status);
});

test("series styling is added, merged and removed when nothing is left in it", () => {
  let s = withSeriesStyle(initialSpec(ALL), 1, { label: "Kits", color: "#112233" });
  s = withSeriesStyle(s, 0, { hidden: true });
  assert.deepEqual(s.series?.map((x) => x.index), [0, 1]);
  s = withSeriesStyle(s, 1, { label: undefined, color: undefined });
  assert.deepEqual(s.series?.map((x) => x.index), [0]);
  s = withSeriesStyle(s, 0, { hidden: false });
  assert.equal(s.series, undefined, "an empty style list is not stored");
});

test("axes: empty values are dropped, a cleared axis disappears", () => {
  let s = withAxis(initialSpec(ALL), "y", { title: "People", min: 0, max: 500 });
  assert.deepEqual(s.axes?.y, { title: "People", min: 0, max: 500 });
  s = withAxis(s, "y", { max: Number.NaN, title: "" });
  assert.deepEqual(s.axes?.y, { min: 0 });
  s = withAxis(s, "y", { min: undefined });
  assert.equal(s.axes, undefined);
  s = withAxis(withAxis(s, "x", { title: "Month" }), "y2", { title: "Kits" });
  assert.deepEqual(Object.keys(s.axes ?? {}).sort(), ["x", "y2"]);
  assert.deepEqual(validateChartSpec(withAxis(initialSpec(ALL), "y", { min: 50 })).map((p) => p.code), ["BAR_AXIS_NOT_ZERO"], "the validator still says no to a cut bar axis");
});

test("annotations can be added, changed and removed", () => {
  let s = addAnnotation(initialSpec(ALL), { id: "a1", type: "LINE", value: 40, text: "Goal" });
  s = addAnnotation(s, { id: "a2", type: "NOTE", text: "Campaign" });
  s = updateAnnotation(s, "a1", { value: 50 });
  assert.equal((s.annotations![0] as { value: number }).value, 50);
  s = removeAnnotation(removeAnnotation(s, "a1"), "a2");
  assert.equal(s.annotations, undefined);
});

test("text settings are removed when emptied, never stored as an empty string", () => {
  assert.equal(withText(withText(initialSpec(ALL), "title", "X"), "title", "  ").title, undefined);
});

test("a refusal with a one-click fix offers it; the others do not", () => {
  const fix = suggestedFix("These indicators use different units (people, kits). Show them as % of target, or put one on a second axis.");
  assert.ok(fix);
  assert.equal(fix!.apply(initialSpec(ALL)).dataset.measure, "PERCENT_OF_TARGET");
  assert.ok(suggestedFix("A heatmap colours every cell on one scale, so the indicators must share a unit (or be shown as % of target)."));
  assert.equal(suggestedFix("A funnel's steps shrink: B is larger than A."), null);
  const hidden = suggestedFix("Every series is hidden.")!.apply({ ...initialSpec(ALL), series: [{ index: 0, hidden: true }] });
  assert.equal(hidden.series?.[0]?.hidden, false);
});

test("the data behind a chart is a table with a gap left empty, and a file safe to open in a spreadsheet", () => {
  const data = {
    indicators: [{ id: "i1", code: "OUT-1", name: 'People, "trained"' }], periods: [], missingIndicatorIds: [], mixedUnits: false, withheldDrafts: 0, notes: [], provenance: { points: 1, unverified: 0 },
    points: [{ indicatorId: "i1", periodId: "p1", periodLabel: "Jan", value: 10, status: "VERIFIED", verified: true }, { indicatorId: "i1", periodId: "p2", periodLabel: "Feb", value: null, status: "", verified: false }, { indicatorId: "i1", periodId: "p3", periodLabel: "Mar", value: 4, status: "DRAFT", verified: false }],
  };
  const t = dataTable(data as never);
  assert.deepEqual(t.rows[1], ["OUT-1", 'People, "trained"', "Feb", "", ""]);
  assert.equal(t.rows[2]![4], "Not verified yet");
  const csv = toCsv(t);
  assert.match(csv, /"People, ""trained"""/);
  assert.equal(csv.split("\r\n").length, 4);
  assert.match(toCsv({ columns: ["a"], rows: [["=SUM(A1)"], ["@x"], ["-5"]] }), /'=SUM\(A1\)\r\n'@x\r\n'-5/);
});

test("download names are plain letters, digits and dashes", () => {
  assert.equal(fileNameFor("OUT-1 Niños formados / Q3", "png"), "OUT-1-Ninos-formados-Q3.png");
  assert.equal(fileNameFor("   ", "csv"), "chart.csv");
  assert.equal(fileNameFor("x".repeat(200), "svg").length, 64);
});

test("every chart kind and family has a name in every language", () => {
  const families = [...new Set(CHART_KIND_ORDER.map((k) => CHART_KINDS[k].family))];
  assert.ok(families.length >= 12);
  for (const locale of LOCALES) {
    for (const k of CHART_KIND_ORDER) assert.ok(MESSAGES[locale][`kind.${k}`], `${locale} kind.${k}`);
    for (const f of families) assert.ok(MESSAGES[locale][`family.${f}`], `${locale} family.${f}`);
  }
  assert.equal(MESSAGES.en["kind.BAR_STACKED_100"], CHART_KINDS.BAR_STACKED_100.label, "English names are the catalogue's own");
});
