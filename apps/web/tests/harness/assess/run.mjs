// A real-browser check of the assessment filler (the real AssessmentFlow, FormFiller, field views, draft store and rules; only the server
// actions are stubbed): choosing a facility, carrying facts forward, sections, tables, repeats, a calculated figure, a rule across answers,
// a drawn signature, autosaved drafts, sending, a phone-sized screen and Urdu (right to left).
//   pnpm --filter @donordesk/web test:assess
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
const out = mkdtempSync(join(tmpdir(), "assess-"));
await build(join(out, "bundle.js"));
execFileSync("npx", ["tailwindcss", "-c", "tailwind.config.ts", "-i", "src/app/globals.css", "-o", join(out, "styles.css")], { cwd: web, stdio: "ignore" });
writeFileSync(join(out, "index.html"), '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="styles.css"></head><body><div id="root"></div><script src="bundle.js"></script></body></html>');
const base = `file://${join(out, "index.html")}`;

const browser = await chromium.launch();
const errors = [];
const results = [];
const check = async (name, fn) => { try { await fn(); results.push(`ok   ${name}`); } catch (e) { results.push(`FAIL ${name} :: ${String(e.message).split("\n").slice(0, 8).join(" ")}`); } };
const DESKTOP = { viewport: { width: 1280, height: 900 } };
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
async function open(hash = "", ctx = DESKTOP) {
  const context = await browser.newContext(ctx);
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 300)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 600)); });
  await page.goto(base + (hash ? `#${hash}` : ""));
  await page.getByTestId("host").waitFor();
  return page;
}
const calls = (page, name) => page.evaluate((n) => window.__h.calls.filter((c) => c[0] === n).map((c) => c[1]), name);
const start = async (page, name) => { await page.getByRole("listitem").filter({ hasText: name }).getByRole("button", { name: "Start" }).click(); await page.getByRole("button", { name: /Send/ }).waitFor(); };
const section = (page, title) => page.getByRole("navigation", { name: "Sections" }).getByRole("button", { name: new RegExp(title) });

await check("facilities: the one given to the person first with its due day, then the rest by name; a village is not offered; typing narrows", async () => {
  const page = await open();
  const items = await page.getByRole("list", { name: "Facilities" }).getByRole("listitem").allInnerTexts();
  assert.deepEqual(items.map((t) => t.split("\n")[0]), ["RHC Dir", "BHU Sheringal", "Zed Clinic"]);
  assert.match(items[0], /Given to you/);
  assert.match(items[0], /due 2026-12-01/);
  assert.ok(!items.join(" ").includes("Village"));
  await page.getByLabel("Find a facility").fill("mardan");
  assert.deepEqual((await page.getByRole("list", { name: "Facilities" }).getByRole("listitem").allInnerTexts()).map((t) => t.split("\n")[0]), ["Zed Clinic"]);
});

await check("not visited asks for a reason and tells the server", async () => {
  const page = await open();
  await page.getByRole("listitem").filter({ hasText: "RHC Dir" }).getByRole("button", { name: "Not visited" }).click();
  const confirm = page.getByRole("button", { name: "Mark as not visited" });
  assert.equal(await confirm.isDisabled(), true, "a reason is needed");
  await page.getByLabel("Why was it not visited?").fill("Road closed");
  await confirm.click();
  assert.deepEqual((await calls(page, "notVisited"))[0], ["f2", "Road closed"]);
});

await check("starting a facility: the last visit's year is carried and marked, the contents lists the sections, a heading is shown", async () => {
  const page = await open();
  await start(page, "RHC Dir");
  assert.equal(await page.getByLabel("Year established (optional)").inputValue(), "1990");
  assert.ok(await page.getByText("From the last visit. Check that it is still right.").isVisible());
  const nav = await page.getByRole("navigation", { name: "Sections" }).innerText();
  for (const s of ["About the facility", "Water", "Buildings"]) assert.match(nav, new RegExp(s));
  assert.ok(await page.getByRole("heading", { name: "About the facility" }).isVisible());
  assert.ok(await page.getByText("Answer from what you see.").isVisible());
  // changing the carried value clears the note
  await page.getByLabel("Year established (optional)").fill("1991");
  assert.equal(await page.getByText("From the last visit. Check that it is still right.").count(), 0);
});

await check("a calculated figure follows the answers; a rule across answers and not applicable are honoured", async () => {
  const page = await open();
  await start(page, "RHC Dir");
  assert.ok(await page.getByText("Answer the questions above to see this.").isVisible());
  await page.getByLabel("Sanctioned beds (optional)").fill("100");
  await page.getByLabel("Functional beds (optional)").fill("80");
  assert.match(await page.getByText("worked out for you").locator("..").innerText(), /80/);
  await page.getByLabel("Functional beds (optional)").fill("150");
  await page.getByLabel("Facility name").fill("RHC Dir");
  await page.getByRole("button", { name: "Send" }).click();
  assert.ok(await page.getByText(/cannot be more than/).first().isVisible(), "the rule is said in a sentence");
  await page.getByLabel("Not applicable").check();
  assert.equal(await page.getByLabel("Why not? (optional)").count(), 1, "the answer becomes a reason box");
  assert.equal(await page.getByText(/cannot be more than/).count(), 0, "a not-applicable answer is not judged");
});

await check("multi-select ticks several; the water section appears only when the unit exists; the table fills by row and column and a cell is judged", async () => {
  const page = await open();
  await start(page, "RHC Dir");
  await page.getByLabel("Facility name").fill("RHC Dir");
  await page.getByLabel("OPD").check();
  await page.getByLabel("Emergency").check();
  assert.equal(await page.getByLabel("OPD").isChecked(), true);
  await section(page, "Water").click();
  assert.equal(await page.getByText("Water checks").count(), 0, "the table is not asked until there is a water system");
  await page.getByLabel("Does it have a water system?").selectOption("yes");
  await page.getByText("Water checks").first().waitFor();
  await page.getByLabel("Storage tank, Working", { exact: true }).selectOption("yes");
  await page.getByLabel("Storage tank, How many", { exact: true }).fill("25");
  await page.getByRole("button", { name: "Send" }).click();
  assert.ok(await page.getByText(/cannot be above 20/).first().isVisible(), "the cell's own limit is said beside the cell");
});

await check("a repeat: add, copy the last row, remove, the most rows is held; a row's own problem is shown on that row", async () => {
  const page = await open();
  await start(page, "RHC Dir");
  await section(page, "Buildings").click();
  assert.ok(await page.getByText("No rows yet.").isVisible());
  await page.getByRole("button", { name: "Add Block" }).click();
  await page.getByLabel("Block name", { exact: true }).fill("Main");
  await page.getByLabel("Condition (optional)").selectOption("good");
  await page.getByRole("button", { name: "Copy the last row" }).click();
  assert.equal(await page.getByRole("group", { name: /Block \d/ }).count(), 2);
  assert.equal(await page.getByLabel("Block name", { exact: true }).nth(1).inputValue(), "Main", "copied");
  await page.getByRole("button", { name: "Remove this row" }).nth(1).click();
  assert.equal(await page.getByRole("group", { name: /Block \d/ }).count(), 1);
  for (let i = 0; i < 5; i += 1) if (await page.getByRole("button", { name: "Add Block" }).count()) await page.getByRole("button", { name: "Add Block" }).click();
  assert.equal(await page.getByRole("group", { name: /Block \d/ }).count(), 4);
  assert.ok(await page.getByText("That is the most rows allowed (4).").isVisible());
});

await check("the score grows with the answers, says what it stands on and that it is illustrative, and skips a section that does not apply", async () => {
  const page = await open();
  await start(page, "RHC Dir");
  const panel = page.getByRole("complementary", { name: "Score so far" });
  assert.match(await panel.innerText(), /Answer some questions to see a score/);
  await section(page, "Buildings").click();
  await page.getByRole("button", { name: "Add Block" }).click();
  await page.getByLabel("Block name", { exact: true }).fill("Main");
  await page.getByLabel("Condition (optional)").selectOption("good");
  const text = await panel.innerText();
  assert.match(text, /100%/);
  assert.match(text, /illustrative/);
  assert.ok(!/Water/.test(text), "the water section is skipped while there is no water system");
});

await check("a signature is drawn, kept as a file and shown as signed; it can be redone", async () => {
  const page = await open();
  await start(page, "RHC Dir");
  await section(page, "Buildings").click();
  const canvas = page.getByLabel("Sign here with your finger or a pen");
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + 20, box.y + 40); await page.mouse.down(); await page.mouse.move(box.x + 120, box.y + 80, { steps: 6 }); await page.mouse.move(box.x + 60, box.y + 30, { steps: 6 }); await page.mouse.up();
  await page.getByRole("button", { name: "Use this signature" }).click();
  await page.getByText(/^Signed/).waitFor();
  const [up] = await calls(page, "upload");
  assert.equal(up[0], "signature.png");
  assert.equal(up[1], "image/png");
  assert.ok(up[2] > 100, "a real image went up");
  await page.getByRole("button", { name: "Sign again" }).click();
  assert.ok(await page.getByRole("button", { name: "Use this signature" }).isVisible());
});

await check("a draft is saved after a pause, comes back when the facility is chosen again, and can be thrown away", async () => {
  const page = await open();
  await start(page, "RHC Dir");
  await page.getByLabel("Facility name").fill("Draft name");
  await page.getByText(/Draft saved at/).waitFor({ timeout: 8000 });
  const stored = await page.evaluate(() => window.__h.draftStore.load("form1", "f2"));
  assert.equal(stored.answers.name, "Draft name");
  await page.getByRole("button", { name: "Change facility" }).click();
  await start(page, "RHC Dir");
  assert.equal(await page.getByLabel("Facility name").inputValue(), "Draft name", "resumed");
  assert.ok(await page.getByText("Continuing the draft you started.").isVisible());
  await page.getByRole("button", { name: "Start again" }).click();
  assert.equal(await page.getByLabel("Facility name").inputValue(), "");
  assert.equal(await page.evaluate(() => window.__h.draftStore.load("form1", "f2")), null);
});

await check("a finished assessment is sent with the facility, the answers in their own shape and when it was started; the draft goes and the list returns", async () => {
  const page = await open();
  await start(page, "RHC Dir");
  await page.getByLabel("Facility name").fill("RHC Dir");
  await page.getByLabel("Sanctioned beds (optional)").fill("100");
  await page.getByLabel("Functional beds (optional)").fill("80");
  await page.getByLabel("Does it have a water system?").selectOption("no").catch(() => undefined);
  await section(page, "Water").click();
  await page.getByLabel("Does it have a water system?").selectOption("no");
  await section(page, "Buildings").click();
  await page.getByRole("button", { name: "Add Block" }).click();
  await page.getByLabel("Block name", { exact: true }).fill("Main");
  await page.getByLabel("Condition (optional)").selectOption("good");
  await page.getByRole("button", { name: "Send" }).click();
  await page.getByRole("list", { name: "Facilities" }).waitFor();
  const [sent] = await calls(page, "submit");
  const input = sent[0];
  assert.equal(input.placeId, "f2");
  assert.equal(input.answers.name, "RHC Dir");
  assert.equal(input.answers.sanctioned, "100");
  assert.equal(input.answers.has_water, "no");
  assert.deepEqual(input.answers.blocks, [{ bname: "Main", cond: "good" }]);
  assert.match(input.startedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(await page.evaluate(() => window.__h.draftStore.load("form1", "f2")), null);
});

await check("on a phone a table is a stack of cards (one per row), not a wide table, and every control is a comfortable size", async () => {
  const page = await open("", PHONE);
  await start(page, "RHC Dir");
  await page.getByLabel("Does it have a water system?").count();
  await section(page, "Water").click().catch(async () => { await page.getByRole("button", { name: "Next section" }).click(); });
  await page.getByLabel("Does it have a water system?").selectOption("yes");
  await page.getByText("Water checks").first().waitFor();
  assert.equal(await page.locator("table").first().isVisible().catch(() => false), false, "no wide table on a phone");
  assert.equal(await page.getByLabel("Storage tank, Working", { exact: true }).isVisible(), true);
  const small = await page.locator("button, select, input:not([type=checkbox]):not([type=file])").evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().height > 0 && e.getBoundingClientRect().height < 40 && getComputedStyle(e).visibility !== "hidden").length);
  assert.ok(small <= 6, `${small} controls are under 40px tall`);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "no sideways scrolling");
});

await check("Urdu: the screens are in Urdu and the page reads right to left", async () => {
  const page = await open("lang=ur");
  assert.equal(await page.evaluate(() => document.documentElement.dir), "rtl");
  assert.ok(await page.getByRole("button", { name: "شروع کریں" }).first().isVisible());
  assert.match(await page.getByRole("list").first().innerText(), /آپ کو سونپی گئی/);
  await page.getByRole("button", { name: "شروع کریں" }).first().click();
  await page.getByRole("button", { name: /بھیجیں/ }).waitFor();
  assert.ok(await page.getByRole("complementary", { name: "اب تک کا اسکور" }).isVisible());
});

await browser.close();
const failed = results.filter((r) => r.startsWith("FAIL"));
console.log(results.join("\n"));
const noise = errors.filter((e) => !/Failed to load resource/.test(e));
if (noise.length) console.log("console errors:\n" + [...new Set(noise)].slice(0, 6).join("\n"));
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length || noise.length ? 1 : 0);
