// A real-browser check of the report builder (the real screen and report engine; only the server actions are stubbed).
//   pnpm --filter @donordesk/web test:report-builder
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
const out = mkdtempSync(join(tmpdir(), "report-builder-"));
await build(join(out, "bundle.js"));
execFileSync("npx", ["tailwindcss", "-c", "tailwind.config.ts", "-i", "src/app/globals.css", "-o", join(out, "styles.css")], { cwd: web, stdio: "ignore" });
writeFileSync(join(out, "index.html"), '<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="styles.css"></head><body><div id="root"></div><script src="bundle.js"></script></body></html>');
const url = `file://${join(out, "index.html")}`;

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1300, height: 1000 }, acceptDownloads: true })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); });
const results = [];
const check = async (name, fn) => { try { await fn(); results.push(`ok   ${name}`); } catch (e) { results.push(`FAIL ${name} :: ${String(e.message).split("\n").slice(0, 8).join(" | ")}`); } };
const H = () => page.evaluate(() => ({ reports: window.__h.reports, saves: window.__h.reportSaves, adds: window.__h.dashboardAdds }));
const table = () => page.getByTestId("report-table");
const rowTexts = async () => (await table().locator("tbody tr").allInnerTexts()).map((r) => r.replace(/\s+/g, " ").trim());

await page.goto(url);
await page.waitForSelector('[data-testid="sentence"]');

await check("the question reads back as one sentence and changes with the choices", async () => {
  assert.match(await page.getByTestId("sentence").innerText(), /Showing results \(3 selected\) for every period; display the value for each period by indicator, broken down by period, including values not yet verified\./);
  await page.getByLabel("display").selectOption("CUMULATIVE");
  assert.match(await page.getByTestId("sentence").innerText(), /the cumulative value to date/);
  await page.getByLabel("display").selectOption("PERIOD");
});

await check("running shows indicators down and periods across; a gap is 'Not measured' and a real zero is 0", async () => {
  await page.getByRole("button", { name: "Run report" }).click();
  await table().waitFor();
  const head = (await table().locator("thead").innerText()).replace(/\s+/g, " ");
  assert.match(head, /Indicator Jan Feb Mar/);
  const rows = await rowTexts();
  assert.match(rows[0], /^A Indicator a \(people\) 10 20 30$/);
  assert.match(rows[1], /^B Indicator b \(kits\) 0 Not measured Not measured$/, "zero stays zero; no entry stays a gap");
});

await check("percent of target leaves a rate out rather than judging it", async () => {
  await page.getByLabel("display").selectOption("PERCENT_OF_TARGET");
  await page.getByRole("button", { name: "Run report" }).click();
  await table().waitFor();
  const rows = await rowTexts();
  assert.match(rows[2], /^R Indicator r \(%\) Not measured Not measured Not measured$/);
  await page.getByLabel("display").selectOption("PERIOD");
});

await check("broken down by group puts the groups across for the last period, with the recorded total", async () => {
  await page.getByLabel("by", { exact: true }).selectOption("GROUP");
  await page.getByRole("button", { name: "Run report" }).click();
  await page.waitForFunction(() => /Female/.test(document.querySelector('[data-testid="report-table"] thead')?.textContent ?? ""));
  const head = (await table().locator("thead").innerText()).replace(/\s+/g, " ");
  assert.match(head, /Indicator Female Male Recorded total/);
  const rows = await rowTexts();
  assert.match(rows[0], /^A Indicator a \(people\) 18 12 30$/);
  assert.match(await page.getByTestId("sentence").innerText(), /broken down by sex/);
  await page.getByLabel("by", { exact: true }).selectOption("INDICATOR");
});

await check("a report is saved as its question, listed, reopened and run again, and downloaded as CSV", async () => {
  await page.getByLabel("Name").fill("Quarterly results");
  await page.getByRole("button", { name: "Save as new" }).click();
  await page.getByText("Saved.").waitFor();
  const h = await H();
  assert.deepEqual(Object.keys(h.saves[0].input.query).sort(), ["includeDraft", "indicatorIds", "measure", "rows"].sort());
  await page.getByRole("button", { name: "Quarterly results" }).click();
  await table().waitFor();
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download CSV" }).click()]);
  const csv = readFileSync(await dl.path(), "utf8");
  assert.match(csv, /^Indicator,Jan,Feb,Mar\r\nA Indicator a \(people\),10,20,30\r\n/);
  assert.match(csv, /B Indicator b \(kits\),0,,\r\n/, "a gap is empty in the file, never 0");
});

await check("a report can be added to a dashboard as a table", async () => {
  await page.getByLabel("Choose a dashboard").selectOption("d1");
  await page.getByRole("button", { name: "Add to a dashboard" }).click();
  await page.getByText("Added to the dashboard.").waitFor();
  const h = await H();
  assert.equal(h.adds[0].dashboardId, "d1");
  assert.equal(h.adds[0].input.title, "Quarterly results");
  assert.equal(h.adds[0].input.report.indicatorIds.length, 3);
});

await check("the screen follows the language", async () => {
  await page.goto(`${url}?lang=fr`);
  await page.waitForSelector('[data-testid="sentence"]');
  assert.match(await page.getByTestId("sentence").innerText(), /^Résultats \(3 sélectionnés\) pour toutes les périodes/);
  await page.goto(`${url}?lang=ar`);
  await page.waitForSelector('[data-testid="sentence"]');
  assert.match(await page.getByTestId("sentence").innerText(), /عرض النتائج/);
});

await browser.close();
console.log(results.join("\n"));
console.log(`page errors: ${errors.length === 0 ? "none" : "\n" + errors.join("\n")}`);
if (results.some((r) => r.startsWith("FAIL")) || errors.length > 0) process.exit(1);
