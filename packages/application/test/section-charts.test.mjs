import assert from "node:assert/strict";
import test from "node:test";
import { SectionChartService, chartArtifactsForSection, chartPayloadToResolved, UpdateReportSectionChartHandler, RefreshSectionChartsHandler } from "../dist/index.js";

const ok = (value) => ({ ok: true, value });
const table = `| Code | Indicator | Unit | Baseline | Target | This period | % of target | Cumulative to date | % of project target |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| IND-1 | Enrolled | children | 0 | 1200 | 240 | 20% | 1260 | 105% |
| IND-2 | Trained | teachers | 0 | 60 | 8 | 13.3% | 60 | 100% |`;
const finance = `| Budget line | Budget (USD) | Expenditure (USD) |\n| --- | --- | --- |\n| Training | 100 | 97 |`;

test("each table of a section gets its own chart artifact, ordered after the section's other artifacts", () => {
  const charts = chartArtifactsForSection({ title: "Results and finance", content: `Results:\n${table}\n\nFinance:\n${finance}` }, 2);
  assert.deepEqual(charts.map((c) => [c.kind, c.ordinal, c.payload.dataBinding, c.payload.tableIndex]), [["CHART", 2, "TABLE_INDICATOR_PROGRESS", 0], ["CHART", 3, "TABLE_FINANCE_BY_LINE", 1]]);
  assert.equal(charts[0].payload.series[0].data[0], 105);
  assert.equal(chartArtifactsForSection({ title: "Annex A Indicator Table", content: table }).length, 0);
});

test("refreshing keeps a section's tables and other artifacts, replaces its charts with ones drawn from its current text", async () => {
  let saved;
  const repo = {
    findBySection: async () => ok([
      { kind: "TABLE", ordinal: 0, caption: "T", payload: { columns: [], rows: [] }, sourceReferences: [] },
      { kind: "CHART", ordinal: 1, caption: "old", payload: { categories: ["x"], series: [] }, sourceReferences: [] },
      { kind: "DELTA", ordinal: 2, caption: "d", payload: {}, sourceReferences: [] },
    ]),
    replaceForSection: async (input) => ((saved = input), ok(undefined)),
  };
  const r = await new SectionChartService(repo).refresh({ tenantId: "t", sectionId: "s1", revisionId: "r1", title: "Results", content: table });
  assert.equal(r.value, 1);
  assert.deepEqual(saved.artifacts.map((a) => [a.kind, a.ordinal]), [["TABLE", 0], ["DELTA", 1], ["CHART", 2]]);
  const edited = table.replace("105%", "90%");
  await new SectionChartService(repo).refresh({ tenantId: "t", sectionId: "s1", revisionId: null, title: "Results", content: edited });
  assert.equal(saved.artifacts.at(-1).payload.series[0].data[0], 90, "an edited table redraws its chart");
  await new SectionChartService(repo).refresh({ tenantId: "t", sectionId: "s1", revisionId: null, title: "Results", content: "No tables here." });
  assert.deepEqual(saved.artifacts.map((a) => a.kind), ["TABLE", "DELTA"], "no table, no chart");
});

test("a stored chart payload resolves to what the renderers draw; one with nothing to draw does not", () => {
  const [chart] = chartArtifactsForSection({ title: "Results", content: table });
  const resolved = chartPayloadToResolved(chart.payload);
  assert.equal(resolved.unit, "%");
  assert.deepEqual(resolved.referenceLine, { name: "Target (100%)", value: 100 });
  assert.equal(chartPayloadToResolved({ categories: [], series: [] }), null);
  assert.equal(chartPayloadToResolved(null), null);
});

function sectionRepo(title) {
  const section = { id: "s1", sectionTitle: title, content: table, updatedAt: new Date("2026-01-01"), chartConfig: null, setChartConfig(c) { this.chartConfig = c; } };
  return { section, findById: async () => ok(section), update: async (s) => ok(s) };
}
const ctx = { tenant: { tenantId: "t", userId: "u" } };
const audit = { record: async () => undefined };

test("a hand-made chart must be able to show its data and belong in its section", async () => {
  const handler = (title) => new UpdateReportSectionChartHandler(sectionRepo(title), audit);
  const pie = await handler("3 Results").handle(ctx, "s1", { chartConfig: { type: "PIE", dataBinding: "INDICATOR_COMPARISON" } });
  assert.equal(pie.ok, false);
  assert.match(pie.error.message, /cannot show this data/);
  const finance = await handler("5 Financial Summary").handle(ctx, "s1", { chartConfig: { type: "BAR", dataBinding: "INDICATOR_COMPARISON" } });
  assert.equal(finance.ok, false);
  assert.match(finance.error.message, /no indicator data/);
  const good = await handler("3 Results").handle(ctx, "s1", { chartConfig: { type: "RADAR", dataBinding: "INDICATOR_PROGRESS" } });
  assert.equal(good.ok, true);
  assert.equal((await handler("3 Results").handle(ctx, "s1", { chartConfig: null })).ok, true, "removing a chart is always allowed");
});

test("rebuilding charts reads the section's current text", async () => {
  let call;
  const handler = new RefreshSectionChartsHandler(sectionRepo("3 Results"), { refresh: async (i) => ((call = i), ok(2)) }, audit);
  const r = await handler.handle(ctx, "s1");
  assert.deepEqual(r.value, { charts: 2 });
  assert.equal(call.title, "3 Results");
  assert.equal(call.content, table);
});
