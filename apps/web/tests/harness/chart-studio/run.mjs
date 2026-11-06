// A real-browser check of the Chart Studio (the real screen and chart builder; only the server actions are stubbed).
//   pnpm --filter @donordesk/web test:studio
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { build } from "./build.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const web = resolve(here, "../../..");
const out = mkdtempSync(join(tmpdir(), "chart-studio-"));
await build(join(out, "bundle.js"));
execFileSync("npx", ["tailwindcss", "-c", "tailwind.config.ts", "-i", "src/app/globals.css", "-o", join(out, "styles.css")], { cwd: web, stdio: "ignore" });
writeFileSync(join(out, "index.html"), '<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="styles.css"></head><body><div id="root"></div><script src="bundle.js"></script></body></html>');
const url = `file://${join(out, "index.html")}`;

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
const page = await context.newPage();
const errors = [];
let current = "(setup)";
page.on("pageerror", (e) => errors.push(`[${current}] ${String(e).slice(0, 200)}`));
page.on("console", (m) => { if (m.type() === "error") errors.push(`[${current}] ${m.text().slice(0, 200)}`); });

const results = [];
const check = async (name, fn) => {
  current = name.slice(0, 40);
  try { await fn(); results.push(`ok   ${name}`); } catch (e) { results.push(`FAIL ${name} :: ${String(e.message).split("\n").slice(0, 8).join(" | ")}`); }
};
const reset = async () => { await page.goto(url); await page.waitForSelector('[data-testid="chart-canvas"]'); };
const H = () => page.evaluate(() => ({ saves: window.__h.saves, deletes: window.__h.deletes, queries: window.__h.queries, saved: window.__h.saved, dashboardAdds: window.__h.dashboardAdds }));
const alt = async () => page.getByTestId("chart-canvas").getAttribute("aria-label");
const kind = (k) => page.locator(`button[data-kind="${k}"]`);
const settled = () => page.waitForTimeout(500);
const openSection = async (title) => { const d = page.locator("details", { has: page.locator("summary", { hasText: new RegExp(`^${title}$`) }) }); if ((await d.getAttribute("open")) === null) await d.locator("summary").click(); };
const downloadOf = async (click) => { const [d] = await Promise.all([page.waitForEvent("download"), click()]); const p = await d.path(); return { name: d.suggestedFilename(), bytes: readFileSync(p) }; };

await reset();

await check("opens with a real chart of the first indicator and the full catalogue of kinds, with unavailable ones disabled", async () => {
  assert.match(await alt(), /Bar chart: A Indicator a/);
  assert.equal(await kind("BAR").getAttribute("aria-pressed"), "true");
  assert.ok((await page.locator("button[data-kind]").count()) >= 40);
  assert.equal(await kind("SANKEY").isDisabled(), true, "needs data we do not hold yet");
  assert.equal(await kind("PIE").isDisabled(), true, "a time series is not parts of a whole");
  assert.equal(await kind("LINE").isDisabled(), false);
  assert.equal(await kind("POPULATION_PYRAMID").getAttribute("title"), "Not available yet");
  assert.equal(await kind("PIE").getAttribute("title"), "Needs different data");
});

await check("choosing another type redraws it; choosing other data keeps a type that fits and fixes one that does not", async () => {
  await kind("LINE").click();
  assert.match(await alt(), /Line chart/);
  await page.getByLabel("Data shown").selectOption("INDICATORS_PROGRESS");
  await settled();
  assert.equal(await kind("PIE").isDisabled(), false, "latest values can be parts of a whole");
  await kind("DONUT").click();
  assert.match(await alt(), /Donut chart/);
  await page.getByLabel("Data shown").selectOption("INDICATOR_VS_TARGET");
  await settled();
  assert.equal(await page.locator('button[data-kind="DONUT"][aria-pressed="true"]').count(), 0, "a donut cannot show baseline, target and result");
  assert.equal(await page.locator('button[aria-pressed="true"][data-kind]').count(), 1, "a kind that fits was chosen for it");
});

await reset();
await check("several indicators: add one, group them, and the legend shows each", async () => {
  await page.getByLabel("Data shown").selectOption("INDICATORS_OVER_TIME");
  await page.getByLabel("B Indicator b", { exact: false }).first().check().catch(async () => { await page.locator("label", { hasText: "Indicator b" }).locator("input").check(); });
  await settled();
  assert.match(await alt(), /2 series over 6 periods/);
  await kind("BAR_STACKED").click();
  assert.match(await alt(), /Stacked bar chart/);
  await kind("BAR_STACKED_100").click();
  assert.ok((await page.getByText("shares of that period's total").count()) > 0);
});

await check("different units are refused with the reason and a one-click fix", async () => {
  await page.locator("label", { hasText: "Indicator c" }).locator("input").check();
  await kind("LINE").click();
  await settled();
  const refused = page.getByTestId("refused");
  assert.match(await refused.innerText(), /different units/);
  await page.getByRole("button", { name: "Show as % of target" }).click();
  await settled();
  assert.equal(await page.getByTestId("refused").count(), 0);
  assert.match(await alt(), /3 series/);
});

await reset();
await check("styling: a title and subtitle, labels, a hidden series and a renamed one all take effect", async () => {
  await page.getByLabel("Data shown").selectOption("INDICATORS_OVER_TIME");
  await page.locator("label", { hasText: "Indicator b" }).locator("input").check();
  await settled();
  await page.getByLabel("Title", { exact: true }).first().fill("Our trainings");
  assert.match(await alt(), /Our trainings/);
  await openSection("Series");
  const b = page.getByRole("group", { name: "B", exact: true });
  await b.getByLabel("Hide").check();
  assert.match(await alt(), /1 series/);
  await b.getByLabel("Hide").uncheck();
  await b.getByLabel("Name").fill("Kits out");
  await page.getByLabel("Show values on the chart").check();
  await page.getByLabel("Number format").selectOption("COMPACT");
  assert.match(await alt(), /2 series/);
});

await check("a bar axis cut above zero is refused by the same rule the server uses, and Save is disabled until it is fixed", async () => {
  await openSection("Axes");
  await page.getByLabel("Value axis Lowest").fill("50");
  await settled();
  assert.match(await page.locator('[role="alert"]').first().innerText(), /starts at zero/);
  assert.equal(await page.getByRole("button", { name: "Save", exact: true }).isDisabled(), true);
  await page.getByLabel("Value axis Lowest").fill("");
  assert.equal(await page.getByRole("button", { name: "Save", exact: true }).isDisabled(), false);
});

await check("annotations can be added and removed", async () => {
  await openSection("Lines and notes");
  await page.getByRole("button", { name: "Add: Reference line" }).click();
  await page.getByLabel("Value", { exact: true }).fill("40");
  assert.equal(await page.getByLabel("Remove").count(), 1);
  await page.getByRole("button", { name: "Add: Note" }).click();
  assert.equal(await page.getByLabel("Remove").count(), 2);
  await page.getByLabel("Remove").first().click();
  await page.getByLabel("Remove").first().click();
  assert.equal(await page.getByLabel("Remove").count(), 0);
});

await reset();
await check("undo and redo walk back through edits one at a time", async () => {
  await kind("LINE").click();
  await kind("AREA").click();
  assert.match(await alt(), /Area chart/);
  await page.getByRole("button", { name: "Undo" }).click();
  assert.match(await alt(), /Line chart/);
  await page.getByRole("button", { name: "Undo" }).click();
  assert.match(await alt(), /Bar chart/);
  await page.getByRole("button", { name: "Redo" }).click();
  assert.match(await alt(), /Line chart/);
  await kind("STEP_LINE").click();
  assert.equal(await page.getByRole("button", { name: "Redo" }).isDisabled(), true, "a new edit clears redo");
});

await reset();
await check("the data table shows every point, a gap is empty, and the CSV download carries it", async () => {
  await page.getByLabel("Data shown").selectOption("INDICATOR_OVER_TIME");
  await page.locator("label", { hasText: "Indicator c" }).locator("input[type=radio]").check();
  await settled();
  await page.getByRole("button", { name: "Data table" }).click();
  const rows = page.getByTestId("data-table").locator("tbody tr");
  assert.equal(await rows.count(), 6);
  assert.equal(await rows.nth(2).locator("td").nth(3).innerText(), "", "no value recorded in March is a gap, never 0");
  const csv = await downloadOf(() => page.getByRole("button", { name: "Data (CSV)" }).click());
  assert.equal(csv.name, "C-Indicator-c.csv");
  const text = csv.bytes.toString("utf8");
  assert.match(text, /Code,Indicator,Period,Value,Status/);
  assert.equal(text.split("\r\n").length, 7);
});

await reset();
await check("the picture can be downloaded as PNG and as SVG", async () => {
  await page.getByTestId("chart-canvas").locator("canvas").waitFor();
  const png = await downloadOf(() => page.getByRole("button", { name: "Image (PNG)" }).click());
  assert.deepEqual([...png.bytes.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
  assert.match(png.name, /\.png$/);
  const svg = await downloadOf(() => page.getByRole("button", { name: "Image (SVG)" }).click());
  assert.match(svg.bytes.toString("utf8"), /^<svg/);
  assert.match(svg.bytes.toString("utf8"), /<path|<rect|<text/);
});

await reset();
await check("a chart is saved with its specification only, listed, reopened exactly, updated, and deleted", async () => {
  await kind("LINE").click();
  await page.getByLabel("Title", { exact: true }).first().fill("Trainings by month");
  await page.getByRole("textbox", { name: "Chart name" }).fill("Trainings");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByTestId("studio-status").filter({ hasText: /^Saved / }).waitFor();
  let h = await H();
  assert.equal(h.saves.length, 1);
  assert.equal(h.saves[0].input.spec.kind, "LINE");
  assert.equal(h.saves[0].input.spec.title, "Trainings by month");
  assert.equal(JSON.stringify(h.saves[0].input).includes("points"), false, "no data is saved, only choices");
  assert.equal(h.saves[0].input.scope, "MINE");
  await page.getByRole("button", { name: "New chart" }).click();
  assert.match(await alt(), /Bar chart/);
  await page.getByRole("button", { name: "Trainings", exact: true }).click();
  assert.match(await alt(), /Line chart: Trainings by month/);
  await kind("AREA").click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.waitForFunction(() => window.__h.saves.length === 2);
  h = await H();
  assert.ok(h.saves[1].chartId, "saving an opened chart updates it");
  assert.ok(h.saves[1].input.expectedUpdatedAt, "with the version it was opened at");
  await page.getByRole("button", { name: "Save as new" }).click();
  await page.waitForFunction(() => window.__h.saves.length === 3);
  assert.equal((await H()).saves[2].chartId, undefined);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: /Delete Trainings/ }).first().click();
  await page.waitForFunction(() => window.__h.deletes.length === 1);
});

await reset();
await check("a save the server refuses is reported and nothing changes on screen", async () => {
  await page.evaluate(() => { window.__h.failNext = "Someone else has changed this chart."; });
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByText("Someone else has changed this chart.").waitFor();
  assert.equal((await H()).saves.length, 0);
  assert.match(await alt(), /Bar chart/);
});

await reset();
await check("the dataset is asked for again only when the data changes, never for styling", async () => {
  await page.waitForTimeout(500);
  const before = (await H()).queries.length;
  await page.getByLabel("Title", { exact: true }).first().fill("Styled");
  await kind("LINE").click();
  await page.getByLabel("Colours").selectOption("COLOUR_BLIND");
  await page.waitForTimeout(700);
  assert.equal((await H()).queries.length, before);
  await page.getByLabel("Measure").selectOption("CUMULATIVE");
  await page.waitForTimeout(700);
  assert.equal((await H()).queries.length, before + 1);
  assert.equal((await H()).queries.at(-1).measure, "CUMULATIVE");
});

await check("more kinds draw from real data: heatmap, funnel, waterfall, gauge, scorecard table", async () => {
  await reset();
  await page.getByLabel("Data shown").selectOption("INDICATORS_OVER_TIME");
  await page.locator("label", { hasText: "Indicator b" }).locator("input").check();
  await settled();
  await kind("HEATMAP").click();
  assert.match(await alt(), /Heatmap chart/);
  await page.getByLabel("Data shown").selectOption("INDICATORS_PROGRESS");
  await page.getByLabel("Measure").selectOption("CUMULATIVE");
  await settled();
  await kind("FUNNEL").click();
  await settled();
  assert.match(await alt(), /Funnel chart|shrink/);
  await kind("SCORECARD_TABLE").click();
  await settled();
  const table = page.getByTestId("chart-table");
  assert.match(await table.innerText(), /% of target/);
  await page.getByLabel("Data shown").selectOption("INDICATOR_VS_TARGET");
  await page.locator("label", { hasText: "Indicator a" }).locator("input").check();
  await page.getByLabel("Measure").selectOption("CUMULATIVE");
  await settled();
  await kind("GAUGE").click();
  assert.match(await alt(), /Gauge chart/);
  await kind("WATERFALL").click();
  assert.match(await alt(), /Waterfall chart/);
});

await check("finance: budget and expenditure to date draw from the project's finance, and say what 'to date' means and what is unverified", async () => {
  await reset();
  await page.getByLabel("Data shown").selectOption("FINANCE_BUDGET_VS_SPEND");
  await settled();
  assert.equal(await page.getByLabel("Measure").count(), 0, "finance has no measure to choose");
  assert.equal(await page.getByText("Indicators", { exact: true }).count(), 0, "finance takes no indicators");
  await kind("BAR_GROUPED").click();
  assert.match(await alt(), /Grouped bar chart: Budget and expenditure to date/);
  assert.equal(await page.getByText(/Expenditure is to date/).count(), 1);
  assert.equal(await page.getByText(/1 of 3 periods' finance figures are not verified yet/).count(), 1);
  await kind("PIE").isDisabled().then((d) => assert.equal(d, true, "budget against spend is not parts of a whole"));
  await page.getByLabel("Include values not verified yet").uncheck();
  await settled();
  assert.equal(await page.getByText(/finance figures are not verified yet/).count(), 0, "the unverified period is left out");
});

await check("waffle and sunburst draw from the latest values", async () => {
  await reset();
  await page.getByLabel("Data shown").selectOption("INDICATORS_PROGRESS");
  await page.getByLabel("Measure").selectOption("CUMULATIVE");
  await page.locator("label", { hasText: "Indicator b" }).locator("input").check();
  await settled();
  await kind("WAFFLE").click();
  assert.match(await alt(), /Waffle \(100 squares\) chart/);
  assert.equal(await page.getByText("Each square is 1% of the total.").count(), 1);
  await page.locator("label", { hasText: "Indicator c" }).locator("input").check();
  await settled();
  await kind("SUNBURST").click();
  assert.match(await alt(), /Sunburst/);
});

await check("earlier versions are listed after a change, can be restored on screen, and become a version again when saved", async () => {
  await reset();
  await page.getByRole("textbox", { name: "Chart name" }).fill("Trainings");
  await kind("LINE").click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByTestId("studio-status").filter({ hasText: /^Saved / }).waitFor();
  assert.equal(await page.getByText("No earlier versions yet.").count(), 1);
  await kind("AREA").click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByTestId("versions").locator("li").first().waitFor();
  assert.equal(await page.getByTestId("versions").locator("li").count(), 1);
  await page.getByRole("button", { name: "Restore" }).click();
  assert.match(await alt(), /Line chart/, "the earlier version is back on screen");
  assert.equal(await page.getByTestId("studio-status").innerText(), "Restored. Press Save to keep it.");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.waitForFunction(() => window.__h.saves.length === 3);
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="versions"] li').length === 2);
});

await check("any chart can be added to a dashboard, as the Studio's own specification", async () => {
  await reset();
  await openSection("Use in a dashboard");
  await page.getByLabel("Choose a dashboard").selectOption("d1");
  await page.getByRole("button", { name: "Add to dashboard" }).click();
  await page.getByText("Added to the dashboard.").waitFor();
  await kind("HEATMAP").isDisabled();
  await page.getByLabel("Data shown").selectOption("INDICATORS_PROGRESS");
  await page.getByLabel("Measure").selectOption("CUMULATIVE");
  await page.locator("label", { hasText: "Indicator b" }).locator("input").check();
  await settled();
  await kind("FUNNEL").click();
  await page.getByRole("button", { name: "Add to dashboard" }).click();
  await page.waitForFunction(() => window.__h.dashboardAdds.length === 2);
  const adds = (await H()).dashboardAdds;
  assert.equal(adds[0].input.spec.version, 2);
  assert.equal(adds[0].input.spec.kind, "BAR");
  assert.equal(adds[1].input.spec.kind, "FUNNEL", "a kind the older dashboards could not hold");
  assert.equal(adds[1].input.projectId, "p1");
});

await check("kind and family names follow the language", async () => {
  await page.goto(`${url}?lang=fr`);
  await page.waitForSelector('[data-testid="chart-canvas"]');
  assert.equal(await page.locator('button[data-kind="BAR"]').innerText(), "Barres");
  assert.equal(await page.locator('button[data-kind="LINE"]').innerText(), "Ligne");
  assert.equal(await page.locator('button[data-kind="WATERFALL"]').innerText(), "Cascade");
  assert.ok((await page.getByText("Parties d’un tout").count()) >= 1);
  await page.goto(`${url}?lang=ar`);
  await page.waitForSelector('[data-testid="chart-canvas"]');
  assert.equal(await page.locator('button[data-kind="PIE"]').innerText(), "دائري");
});

await check("the work plan, completed activities by day and the budget draw as a Gantt, a calendar and a flow", async () => {
  await reset();
  await page.getByLabel("Data shown").selectOption("PLAN_TIMELINE");
  await settled();
  assert.equal(await page.getByText("Indicators", { exact: true }).count(), 0, "the plan is not about indicators");
  await kind("GANTT").click();
  assert.match(await alt(), /Gantt chart: Work plan timeline\. 3 planned items/);
  assert.equal(await page.getByText(/on time, late, done or cancelled/).count(), 1);
  assert.equal((await H()).queries.at(-1).sources[0], "PLAN");
  await page.getByLabel("Data shown").selectOption("ACTIVITY_DAYS");
  await settled();
  await kind("CALENDAR_HEATMAP").click();
  assert.match(await alt(), /Calendar heatmap chart: Completed activities by day\. 3 days/);
  assert.equal(await page.getByText(/blank, not zero/).count(), 1);
  await page.getByLabel("Data shown").selectOption("BUDGET_FLOW");
  await settled();
  await kind("SANKEY").click();
  assert.match(await alt(), /Sankey chart: Budget flow\. 3 budget lines/);
  assert.equal(await page.getByText(/Amounts are in USD/).count(), 1);
  assert.equal(await kind("BAR").isDisabled(), true, "a bar chart cannot show budget flows");
});

await check("results by place: a ranking, graduated symbols and a choropleth on the bundled world map, with unknown countries and unpinned places said", async () => {
  await reset();
  await page.getByLabel("Data shown").selectOption("RESULTS_BY_PLACE");
  await settled();
  await page.getByRole("combobox", { name: "Places at" }).selectOption("0");
  await settled();
  assert.equal((await H()).queries.at(-1).placeLevel, 0);
  assert.equal(await page.getByLabel("Measure").count(), 0, "a place chart has no measure to choose");
  await kind("BAR").click();
  assert.match(await alt(), /Bar chart: A Indicator a by place/);
  await kind("GRADUATED_SYMBOLS").click();
  await page.getByTestId("chart-canvas").locator("canvas").waitFor();
  assert.match(await alt(), /Graduated symbols map/);
  assert.equal(await page.getByText(/1 place has a value but no pin, so it is not on the map: Atlantis/).count(), 1);
  await kind("CHOROPLETH").click();
  await page.getByTestId("missing-regions").waitFor();
  assert.match(await page.getByTestId("missing-regions").innerText(), /Atlantis/, "a name the map does not know is said");
  assert.doesNotMatch(await page.getByTestId("missing-regions").innerText(), /Sudan|Chad/, "the countries it knows are coloured");
  assert.ok((await page.getByText(/grey, not zero/).count()) >= 1);
  await page.getByRole("combobox", { name: "Places at" }).selectOption("2");
  await settled();
  assert.equal((await H()).queries.at(-1).placeLevel, 2);
});

if (process.env.STUDIO_SHOT) {
  await reset();
  await page.getByLabel("Data shown").selectOption("RESULTS_BY_PLACE");
  await settled();
  await page.getByRole("combobox", { name: "Places at" }).selectOption("0");
  await settled();
  await kind("GRADUATED_SYMBOLS").click();
  await page.getByTestId("chart-canvas").locator("canvas").waitFor();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: process.env.STUDIO_SHOT, fullPage: true });
}

console.log(results.join("\n"));
console.log("page errors:", errors.length ? [...new Set(errors)].join("\n  ") : "none");
await browser.close();
process.exit(results.some((r) => r.startsWith("FAIL")) || errors.length > 0 ? 1 : 0);
