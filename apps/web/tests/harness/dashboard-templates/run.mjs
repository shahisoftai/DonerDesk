// A real-browser check of the dashboard template screens (gallery, apply with role mapping, editor); only the server actions are stubbed.
//   pnpm --filter @donordesk/web test:templates
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { build } from "./build.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const web = resolve(here, "../../..");
const out = mkdtempSync(join(tmpdir(), "dash-templates-"));
await build(join(out, "bundle.js"));
execFileSync("npx", ["tailwindcss", "-c", "tailwind.config.ts", "-i", "src/app/globals.css", "-o", join(out, "styles.css")], { cwd: web, stdio: "ignore" });
writeFileSync(join(out, "index.html"), '<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="styles.css"></head><body><div id="root"></div><script src="bundle.js"></script></body></html>');
const url = (view) => `file://${join(out, "index.html")}?view=${view}`;

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
const page = await context.newPage();
const errors = [];
let current = "(setup)";
page.on("pageerror", (e) => errors.push(`[${current}] ${String(e).slice(0, 200)}`));
page.on("console", (m) => { if (m.type() === "error") errors.push(`[${current}] ${m.text().slice(0, 200)}`); });
const results = [];
const check = async (name, fn) => { current = name.slice(0, 40); try { await fn(); results.push(`ok   ${name}`); } catch (e) { results.push(`FAIL ${name} :: ${String(e.message).split("\n").slice(0, 8).join(" | ")}`); } };
const H = () => page.evaluate(() => ({ ...window.__h, pushed: window.__pushed }));
const open = async (view) => { await page.goto(url(view)); await page.waitForSelector("h1, section[aria-label], [data-template]"); };

await open("gallery");
await check("every sector's starter template is listed, labelled a draft, with a way to use or copy it", async () => {
  assert.ok((await page.locator("[data-template]").count()) >= 6);
  assert.equal(await page.getByText("Draft template").count(), await page.locator("[data-template]").count());
  assert.ok((await page.getByRole("button", { name: "Use this template" }).count()) >= 6);
  assert.ok((await page.getByRole("button", { name: "Copy and edit" }).count()) >= 6);
  assert.ok(await page.getByRole("heading", { name: "Water, sanitation and hygiene", exact: true, level: 2 }).isVisible());
});

await check("using a template suggests which indicator answers each role, never guessing, and says how many charts can be drawn", async () => {
  await page.locator('[data-template="tpl-wash-access-hygiene"]').getByRole("button", { name: "Use this template" }).click();
  await page.getByTestId("apply-panel").waitFor();
  assert.equal(await page.getByLabel("People with basic water access").inputValue(), "i1");
  assert.equal(await page.getByLabel("People with basic sanitation").inputValue(), "i2");
  assert.equal(await page.getByLabel("Handwashing facilities").inputValue(), "i3");
  assert.equal(await page.getByLabel("People reached by hygiene promotion").inputValue(), "i4");
  assert.equal(await page.getByLabel("Water points functioning").inputValue(), "i5");
  assert.match(await page.getByTestId("apply-preview").innerText(), /6 charts can be drawn now/);
  assert.equal(await page.getByLabel("Dashboard name").inputValue(), "Water, sanitation and hygiene: access and results");
});

await check("a role can be left empty (its charts are named as left out), and one indicator answers only one role", async () => {
  await page.getByLabel("People with basic sanitation").selectOption("");
  assert.match(await page.getByTestId("apply-preview").innerText(), /Left out until chosen/);
  await page.getByLabel("People with basic sanitation").selectOption("i1");
  assert.equal(await page.getByLabel("People with basic water access").inputValue(), "", "choosing it for a second role cleared the first");
  await page.getByLabel("People with basic water access").selectOption("i2");
  await page.getByLabel("People with basic sanitation").selectOption("i1");
  assert.equal(await page.getByLabel("People with basic water access").inputValue(), "i2");
});

await check("choosing another project reloads its indicators and suggestions", async () => {
  await page.getByLabel("Project").selectOption("p2");
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="apply-panel"] select').length > 0);
  assert.equal(await page.getByLabel("People with basic water access").inputValue(), "", "nothing in the health project fits a water role");
  assert.match(await page.getByTestId("apply-preview").innerText(), /\b1 chart can be drawn now|\b0 charts/);
  await page.getByLabel("Project").selectOption("p1");
  await page.waitForFunction(() => document.querySelector('[data-testid="apply-panel"] select[aria-label="People with basic water access"]').value === "i1");
});

await check("creating the dashboard sends the project, the name, the scope and exactly the role choices; the result links to it", async () => {
  await page.getByLabel("Dashboard name").fill("Our WASH view");
  await page.getByRole("button", { name: "Create the dashboard" }).click();
  await page.getByTestId("applied").waitFor();
  const [a] = (await H()).applies;
  assert.equal(a.id, "tpl-wash-access-hygiene");
  assert.equal(a.input.projectId, "p1");
  assert.equal(a.input.name, "Our WASH view");
  assert.equal(a.input.scope, "MINE");
  assert.equal(a.input.mapping.people_basic_water, "i1");
  assert.equal(await page.getByRole("link", { name: "Open it" }).getAttribute("href"), "/dashboards/dash1");
});

await check("'Copy and edit' makes the organisation's own copy of a built-in (never the built-in itself) and opens it", async () => {
  await open("gallery");
  await page.locator('[data-template="tpl-health-mnch"]').getByRole("button", { name: "Copy and edit" }).click();
  await page.waitForFunction(() => window.__pushed.length === 1);
  const h = await H();
  assert.equal(h.saves[0].body.basedOn, "tpl-health-mnch");
  assert.equal(h.saves[0].id, undefined);
  assert.match(h.pushed[0], /^\/dashboards\/templates\/own\d+$/);
});

await open("editor-builtin");
await check("a built-in template opens read-only, with a way to copy it", async () => {
  assert.ok(await page.getByText("Draft template (built in)").isVisible());
  assert.equal(await page.getByLabel("Template title").isDisabled(), true);
  assert.equal(await page.getByRole("button", { name: "Save" }).count(), 0);
  assert.equal(await page.getByRole("button", { name: "Copy and edit" }).count(), 1);
});

await open("editor-own");
await check("the editor changes details, a role, and a chart; each change keeps the template applicable and Save sends it with the version it was opened at", async () => {
  await page.getByLabel("Template title").fill("Our WASH view");
  await page.getByLabel("Sector").selectOption("HEALTH");
  await page.getByLabel("Name of handwashing_facilities").fill("Handwashing points");
  await page.getByLabel("New role name").fill("Latrines built");
  await page.getByRole("button", { name: "Add role" }).click();
  assert.equal(await page.locator('[data-role="latrines_built"]').count(), 1);
  const w = page.locator('[data-widget="trend-1"]');
  await w.getByLabel(/^Title of/).fill("Water access over time");
  await w.getByLabel(/^Chart type of/).selectOption("AREA");
  await w.getByLabel(/^Measure of/).selectOption("PERIOD");
  await page.getByRole("button", { name: "Save" }).click();
  await page.getByTestId("editor-message").filter({ hasText: "Saved." }).waitFor();
  const [s] = (await H()).saves;
  assert.equal(s.id, "own0");
  assert.equal(s.body.title, "Our WASH view");
  assert.equal(s.body.sector, "HEALTH");
  assert.equal(s.body.expectedUpdatedAt, "2026-10-10T08:00:00.000Z");
  assert.ok(s.body.roles.some((r) => r.key === "latrines_built"));
  const wid = s.body.widgets.find((x) => x.id === "trend-1");
  assert.deepEqual([wid.title, wid.chart.kind, wid.chart.measure], ["Water access over time", "AREA", "PERIOD"]);
});

await check("removing a role that charts use is refused by name; a chart can be added, resized, moved and removed; a note can be added", async () => {
  await page.locator('[data-role="people_basic_water"]').getByRole("button", { name: "Remove" }).click();
  assert.match(await page.getByTestId("editor-message").innerText(), /Charts still use this role/);
  const before = await page.locator("[data-widget]").count();
  await page.getByRole("button", { name: "Add a chart" }).click();
  await page.getByRole("button", { name: "Add a note" }).click();
  assert.equal(await page.locator("[data-widget]").count(), before + 2);
  const last = page.locator("[data-widget]").nth(before);
  await last.getByLabel(/^Size of/).selectOption({ label: "Full width" });
  await last.getByRole("button", { name: "Up" }).click();
  await page.locator("[data-widget]").filter({ has: page.getByLabel(/^Text of/) }).getByRole("button", { name: "Remove" }).click();
  assert.equal(await page.locator("[data-widget]").count(), before + 1);
  assert.ok((await page.getByTestId("layout").locator("div").count()) >= before + 1);
});

await check("an empty title is refused with the reason and nothing is lost; a stale save is reported", async () => {
  await page.getByLabel("Template title").fill("");
  assert.match(await page.getByTestId("editor-message").innerText(), /needs a title/);
  assert.equal(await page.getByLabel("Template title").inputValue(), "Our WASH view", "the last valid title stays");
  await page.evaluate(() => { window.__h.failNext = "Someone else has changed this template since you opened it."; });
  await page.getByRole("button", { name: "Save" }).click();
  await page.getByText(/Someone else has changed this template/).waitFor();
});

await check("deleting asks first and leaves for the gallery", async () => {
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Delete" }).click();
  await page.waitForFunction(() => window.__h.deletes.length === 1);
  assert.equal((await H()).pushed.at(-1), "/dashboards/templates");
});

await open("canvas");
await check("the dashboard canvas shows a text block, a table kind and a refusal beside a drawn chart", async () => {
  assert.equal(await page.getByTestId("text-widget").innerText(), "Figures are cumulative to date.");
  const t = page.getByTestId("table-widget");
  assert.deepEqual(await t.locator("th").allInnerTexts(), ["Code", "Indicator", "% of target"]);
  assert.equal(await t.locator("tbody tr").count(), 2);
  assert.equal(await t.locator("td").nth(5).innerText(), "Not measured");
  assert.match(await page.getByText("This chart is from a project you cannot see.").innerText(), /cannot see/);
  assert.equal(await page.getByText("Scorecard").first().isVisible(), true, "the table's title is the widget title");
});

console.log(results.join("\n"));
console.log("page errors:", errors.length ? [...new Set(errors)].join("\n  ") : "none");
await browser.close();
process.exit(results.some((r) => r.startsWith("FAIL")) || errors.length > 0 ? 1 : 0);
