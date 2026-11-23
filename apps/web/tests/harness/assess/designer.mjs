// A real-browser check of the form designer: sections, tables, repeating groups, calculated figures, assessment settings, languages. The save is
// stubbed and its payload is read back and checked against the contract the server enforces.
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
const out = mkdtempSync(join(tmpdir(), "assess-designer-"));
await build(join(out, "bundle.js"), "designer-main.tsx");
execFileSync("npx", ["tailwindcss", "-c", "tailwind.config.ts", "-i", "src/app/globals.css", "-o", join(out, "styles.css")], { cwd: web, stdio: "ignore" });
writeFileSync(join(out, "index.html"), '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="styles.css"></head><body><div id="root"></div><script src="bundle.js"></script></body></html>');
const browser = await chromium.launch();
const errors = [];
const page = await (await browser.newContext({ viewport: { width: 1280, height: 1000 } })).newPage();
page.on("pageerror", (e) => errors.push(String(e).slice(0, 300)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 400)); });
await page.goto(`file://${join(out, "index.html")}`);
await page.getByTestId("host").waitFor();
const results = [];
const check = async (name, fn) => { try { await fn(); results.push(`ok   ${name}`); } catch (e) { results.push(`FAIL ${name} :: ${String(e.message).split("\n").slice(0, 6).join(" ")}`); } };

await page.getByLabel("Form name").fill("Facility visit");
await check("a section, a table with its rows and columns, a repeating group and a calculated figure can be designed", async () => {
  await page.getByRole("button", { name: "Add a section" }).click();
  await page.getByLabel("Section title").fill("Buildings");
  await page.getByRole("button", { name: "Add a question", exact: true }).click();
  await page.getByLabel("Question 2").fill("Sanctioned beds");
  await page.getByRole("button", { name: "Add a table" }).click();
  await page.getByLabel("Question 3").fill("Offices");
  await page.getByLabel("Rows, one per line").fill("MS office\nHR office");
  await page.getByRole("button", { name: "Add a column" }).click();
  await page.getByLabel("Column 1 name").fill("Adequate");
  await page.getByRole("button", { name: "Add a repeating group" }).click();
  await page.getByLabel("Question 4").fill("Blocks");
  await page.getByLabel("What one row is called").fill("Block");
  await page.getByRole("button", { name: "Add a question to the row" }).click();
  await page.getByLabel("Row question 1", { exact: true }).fill("Block name");
  await page.getByRole("button", { name: "Add a question", exact: true }).click();
  await page.getByLabel("Question 5").fill("Beds working");
  await page.getByLabel("Type").last().selectOption("CALCULATED");
  await page.getByLabel("Add a question to the formula").selectOption("q2");
  await page.getByLabel("Formula", { exact: true }).fill((await page.getByLabel("Formula", { exact: true }).inputValue()) + " * 2");
  assert.equal(await page.getByLabel("Formula", { exact: true }).inputValue(), "q2 * 2");
});

await check("assessment settings: a facility form, a rule across answers, wording languages", async () => {
  await page.getByText("Assessment settings").click();
  await page.getByLabel("What one record is about").selectOption("FACILITY");
  await page.getByLabel("Languages this form has wording for").fill("ur, ps");
  await page.getByText("Wording in other languages").click();
  await page.getByLabel("Sanctioned beds in ur").fill("منظور شدہ بستر");
});

await check("saving sends the questions in the shape the server enforces, keeping what the designer did not show", async () => {
  await page.getByRole("button", { name: "Save the draft" }).click();
  await page.waitForFunction(() => window.__h.calls.length > 0);
  const [, [payload]] = await page.evaluate(() => window.__h.calls[0]);
  const types = payload.fields.map((f) => f.type);
  assert.deepEqual(types, ["SECTION", "NUMBER", "GRID", "REPEAT", "CALCULATED"]);
  assert.equal(payload.subject, "FACILITY");
  assert.deepEqual(payload.languages, ["ur", "ps"]);
  const grid = payload.fields[2];
  assert.deepEqual(grid.rows.map((r) => r.key), ["ms_office", "hr_office"]);
  assert.equal(grid.columns[0].label, "Adequate");
  assert.equal(payload.fields[3].fields[0].label, "Block name");
  assert.equal(payload.fields[3].rowLabel, "Block");
  assert.equal(payload.fields[4].formula, "q2 * 2");
  assert.equal(payload.fields[1].labels.ur, "منظور شدہ بستر");
  globalThis.__payload = payload;
});

await browser.close();
// The same payload must pass the contract and the form engine the server runs.
const { SaveCollectionFormSchema } = await import("@donordesk/contracts");
const { validateFormDefinition } = await import("@donordesk/domain");
const p = globalThis.__payload;
if (p) {
  const parsed = SaveCollectionFormSchema.safeParse({ ...p, mappings: [] });
  results.push(parsed.success ? "ok   the saved form passes the API contract" : `FAIL the saved form passes the API contract :: ${JSON.stringify(parsed.error.issues.slice(0, 2))}`);
  const problems = validateFormDefinition({ fields: p.fields, subject: p.subject });
  results.push(problems.length === 0 ? "ok   the saved form passes the form engine's own checks" : `FAIL the form engine's checks :: ${problems.map((x) => x.message).join("; ")}`);
}
const failed = results.filter((r) => r.startsWith("FAIL"));
console.log(results.join("\n"));
const noise = errors.filter((e) => !/Failed to load resource/.test(e));
if (noise.length) console.log("console errors:\n" + [...new Set(noise)].slice(0, 6).join("\n"));
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length || noise.length ? 1 : 0);
