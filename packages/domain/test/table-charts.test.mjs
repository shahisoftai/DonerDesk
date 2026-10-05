import assert from "node:assert/strict";
import test from "node:test";
import {
  parseMarkdownTables, classifyTable, chartsForSection, tableChartToResolved, parseTableNumber,
  resolveChartData, buildChartOption, chartAchievement, coerceChartType, allowedChartTypes, bindingsForSection,
} from "../dist/index.js";

const indicatorTable = `| Code | Indicator | Unit | Baseline | Target | This period | Previous | % of target | Cumulative to date | % of project target | Status | Data source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| IND-1 | Children enrolled | children | 0 | 1200 | 240 | — | 20% | 1260 | 105% | On track | Registers |
| IND-2 | Teachers trained | teachers | 0 | 60 | 8 | — | 13.3% | 60 | 100% | On track | Sheets |
| IND-3 | Spaces rehabilitated | learning spaces | 0 | 12 | 1 | — | 8.3% | 12 | 100% | On track | Certificates |
| IND-6 | Attendance rate | % | 62 | 85 | 86 | — | 101.2% | 86 | 101.2% | On track | Registers |`;
const financeTable = `| Budget line | Budget (USD) | Expenditure (USD) | Balance (USD) | Burn rate |
| --- | --- | --- | --- | --- |
| Teacher training | 60000 | 58200 | 1800 | 97% |
| Learning kits | 60000 | 58200 | 1800 | 97% |
| **Total** | 120000 | 116400 | 3600 | 97% |`;
const activityTable = `| Activity | Total | Male | Female | Children | People with disabilities |
| --- | --- | --- | --- | --- | --- |
| Enrolment drive | 240 | 115 | 125 | — | — |
| Teacher training | 8 | 4 | 4 | — | — |`;

test("tables are parsed with their header, rows and the line that names them", () => {
  const tables = parseMarkdownTables(`Intro paragraph.\n\nVerified results:\n${indicatorTable}\n\nMore text.\n\n${financeTable}`);
  assert.equal(tables.length, 2);
  assert.equal(tables[0].caption, "Verified results");
  assert.equal(tables[0].rows.length, 4);
  assert.equal(tables[1].index, 1);
  assert.equal(classifyTable(tables[0]), "INDICATORS");
  assert.equal(classifyTable(tables[1]), "FINANCE");
  assert.equal(parseMarkdownTables("| a | b |\n| --- | --- |\n| 1\\|2 | 3 |")[0].rows[0][0], "1|2");
});

test("table numbers: percents, thousands, currencies; blanks and 'not calculable' are not zero", () => {
  assert.equal(parseTableNumber("105%"), 105);
  assert.equal(parseTableNumber("1,260"), 1260);
  assert.equal(parseTableNumber("USD 3,000.50"), 3000.5);
  assert.equal(parseTableNumber("—"), null);
  assert.equal(parseTableNumber("Not calculable"), null);
  assert.equal(parseTableNumber(""), null);
});

test("an indicator table gives a progress chart in % of the project target, with a 100% reference — not mixed raw units", () => {
  const [chart] = chartsForSection({ title: "3 Results Against the Logframe", content: indicatorTable });
  assert.equal(chart.binding, "TABLE_INDICATOR_PROGRESS");
  assert.deepEqual(chart.categories, ["IND-1", "IND-2", "IND-3", "IND-6"]);
  assert.deepEqual(chart.series[0].data, [105, 100, 100, 101.2]);
  assert.equal(chart.unit, "%");
  assert.equal(chart.referenceLine.value, 100);
  assert.match(chart.series[0].name, /project target/);
});

test("a finance table gives budget vs expenditure per line (the total row is left out), a participants table a stacked split", () => {
  const sections = chartsForSection({ title: "5 Financial Summary", content: `${financeTable}\n\n${activityTable}` });
  assert.equal(sections.length, 2);
  const [fin, act] = sections;
  assert.deepEqual(fin.categories, ["Teacher training", "Learning kits"]);
  assert.deepEqual(fin.series.map((s) => s.name), ["Budget", "Expenditure"]);
  assert.equal(fin.unit, "USD");
  assert.equal(fin.tableIndex, 0);
  assert.deepEqual(act.series.map((s) => s.name), ["Female", "Male"]);
  assert.equal(act.stacked, true);
  assert.equal(act.tableIndex, 1);
});

test("a section with several tables gets a chart for each, each tied to its own table", () => {
  const content = `Results:\n${indicatorTable}\n\nFinance:\n${financeTable}`;
  const charts = chartsForSection({ title: "Results and finance", content });
  assert.deepEqual(charts.map((c) => [c.binding, c.tableIndex, c.tableCaption]), [["TABLE_INDICATOR_PROGRESS", 0, "Results"], ["TABLE_FINANCE_BY_LINE", 1, "Finance"]]);
});

test("annex sections, unrecognised tables, one-row tables and duplicate tables give no (extra) chart", () => {
  assert.deepEqual(chartsForSection({ title: "Annex A Indicator Performance Table", content: indicatorTable }), []);
  assert.deepEqual(chartsForSection({ title: "Notes", content: "| A | B |\n| --- | --- |\n| 1 | 2 |\n| 3 | 4 |" }), []);
  assert.deepEqual(chartsForSection({ title: "Results", content: indicatorTable.split("\n").slice(0, 3).join("\n") }), []);
  assert.equal(chartsForSection({ title: "Results", content: `${indicatorTable}\n\n${indicatorTable}` }).length, 1);
});

test("a table that is edited changes its chart (the chart follows the table)", () => {
  const edited = indicatorTable.replace("| 105% |", "| 90% |");
  const [chart] = chartsForSection({ title: "Results", content: edited });
  assert.equal(chart.series[0].data[0], 90);
});

test("without the project-target column the chart falls back to the table's own percent, then to value / target", () => {
  const t = `| Code | Indicator | Unit | Baseline | Target | This period | % of target |\n| --- | --- | --- | --- | --- | --- | --- |\n| A | a | x | 0 | 100 | 40 | 40% |\n| B | b | y | 0 | 50 | 25 | — |`;
  const [chart] = chartsForSection({ title: "Results", content: t });
  assert.deepEqual(chart.series[0].data, [40, 50], "B's blank percentage is computed from 25 / 50");
});

// ── manual indicator charts: units, missing data, caps, types ──

const row = (code, unit, baseline, target, achievement) => ({ code, name: code, unit, baseline, target, achievement, status: "VERIFIED" });
const config = (dataBinding, type = "BAR") => ({ type, dataBinding, options: {} });

test("indicators of different units are drawn as % of their own target, never on one raw axis", () => {
  const rows = [row("IND-1", "children", "0", "1200", "240"), row("IND-2", "teachers", "0", "60", "8"), row("IND-6", "%", "62", "85", "86")];
  const r = resolveChartData(rows, config("INDICATOR_COMPARISON"));
  assert.equal(r.unit, "%");
  assert.deepEqual(r.series.map((s) => s.name), ["Baseline (% of target)", "Achievement (% of target)"]);
  assert.deepEqual(r.series[1].data, [20, 13.3, 101.2]);
  assert.equal(r.referenceLine.value, 100);
  const same = resolveChartData([row("A", "kits", "0", "100", "40"), row("B", "kits", "0", "200", "50")], config("INDICATOR_COMPARISON"));
  assert.equal(same.unit, "kits");
  assert.deepEqual(same.series.map((s) => s.name), ["Baseline", "Target", "Achievement"]);
});

test("an indicator with no value is left out, never plotted as zero; categories are capped", () => {
  const r = resolveChartData([row("A", "kits", "0", "100", "40"), row("B", "kits", "0", "100", "")], config("INDICATOR_ACHIEVEMENT"));
  assert.deepEqual(r.categories, ["A"]);
  const many = Array.from({ length: 20 }, (_, i) => row(`I${i}`, "kits", "0", "100", String(i + 1)));
  const capped = resolveChartData(many, config("INDICATOR_PROGRESS"));
  assert.equal(capped.categories.length, 12);
  assert.deepEqual(capped.truncated, { shown: 12, total: 20 });
});

test("a roll-up report plots the cumulative figure; a rate and a period report plot the period value", () => {
  assert.equal(chartAchievement({ reportType: "FINAL", indicatorType: "NUMBER", periodValue: "240", cumulativeValue: "1260" }), "1260");
  assert.equal(chartAchievement({ reportType: "FINAL", indicatorType: "PERCENTAGE", periodValue: "86", cumulativeValue: "86" }), "86");
  assert.equal(chartAchievement({ reportType: "MONTHLY", indicatorType: "NUMBER", periodValue: "240", cumulativeValue: "1260" }), "240");
  assert.equal(chartAchievement({ reportType: "FINAL", indicatorType: "NUMBER", periodValue: "", cumulativeValue: "" }), "");
});

test("chart types a binding cannot show are coerced; a gauge needs exactly one thing", () => {
  assert.equal(coerceChartType("INDICATOR_COMPARISON", "PIE"), "BAR");
  assert.equal(coerceChartType("INDICATOR_COMPARISON", "LINE"), "BAR");
  assert.equal(coerceChartType("INDICATOR_PROGRESS", "RADAR"), "RADAR");
  assert.equal(coerceChartType("INDICATOR_PROGRESS", "GAUGE", 6), "BAR");
  assert.equal(coerceChartType("INDICATOR_PROGRESS", "GAUGE", 1), "GAUGE");
  assert.equal(coerceChartType("STATUS_DISTRIBUTION", "PIE"), "PIE");
  assert.deepEqual(allowedChartTypes("TABLE_FINANCE_BY_LINE"), ["BAR"]);
  const rows = [row("A", "kits", "0", "100", "40"), row("B", "kits", "0", "100", "50")];
  assert.equal(buildChartOption(rows, config("INDICATOR_COMPARISON", "PIE")).series.every((s) => s.type === "bar"), true);
});

test("a radar plots every series with its own name and an axis that fits the data", () => {
  const rows = [row("A", "kits", "0", "100", "140"), row("B", "kits", "0", "100", "50"), row("C", "kits", "0", "100", "60")];
  const option = buildChartOption(rows, config("INDICATOR_PROGRESS", "RADAR"));
  assert.equal(option.series[0].data[0].name, "% of target");
  assert.ok(option.radar.indicator[0].max >= 140);
});

test("sections: financial, annex and evidence sections have no manual indicator chart", () => {
  assert.deepEqual(bindingsForSection("5 Financial Summary"), []);
  assert.deepEqual(bindingsForSection("Annex B Evidence Log"), []);
  assert.equal(bindingsForSection("3 Results Against the Logframe")[0], "INDICATOR_PROGRESS");
});

test("a derived chart resolves to the dataset the renderers draw", () => {
  const [chart] = chartsForSection({ title: "5 Financial Summary", content: financeTable });
  const resolved = tableChartToResolved(chart);
  assert.equal(resolved.dataBinding, "TABLE_FINANCE_BY_LINE");
  assert.equal(resolved.unit, "USD");
});
