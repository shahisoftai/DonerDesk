// A real-browser check of the Entry Sheet inside the real IndicatorEntryGrid (only the server actions, router, outbox and comments are
// stubbed). Not part of `pnpm test`: it builds a bundle and the stylesheet (about a minute) and drives Chromium.
//   pnpm --filter @donordesk/web test:sheet
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
const out = mkdtempSync(join(tmpdir(), "entry-sheet-"));
await build(join(out, "bundle.js"));
execFileSync("npx", ["tailwindcss", "-c", "tailwind.config.ts", "-i", "src/app/globals.css", "-o", join(out, "styles.css")], { cwd: web, stdio: "ignore" });
writeFileSync(join(out, "index.html"), '<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="styles.css"></head><body><div id="root"></div><script src="bundle.js"></script></body></html>');
const url = `file://${join(out, "index.html")}`;

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1360, height: 900 } });
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
const reset = async ({ keepStorage = false } = {}) => {
  await context.setOffline(false);
  await page.goto(url);
  if (!keepStorage) { await page.evaluate(() => localStorage.clear()); await page.reload(); }
  await page.waitForSelector('[role="grid"]');
};
const headers = async () => page.locator('[role="columnheader"] > span:first-child').allInnerTexts();
const col = async (label) => (await headers()).indexOf(label);
const cell = (r, c) => page.locator(`#sheet-cell-${r}-${c}`);
const val = async (r, label) => cell(r, await col(label)).evaluate((td) => [...(td.querySelector("span.block")?.childNodes ?? [])].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(""));
const H = () => page.evaluate(() => window.__h);
const grid = page.locator('[role="grid"]');
const rowCount = () => page.locator('[role="gridcell"][aria-colindex="1"]').count();
const status = async () => (await page.locator('[data-testid="autosave"]').first().textContent().catch(() => "")) ?? "";
const type = async (r, label, text) => { await cell(r, await col(label)).click(); await page.keyboard.type(text); await page.keyboard.press("Enter"); };

await reset();

await check("renders the real grid: 7 rows, frozen code and name, an earlier-period column with its value", async () => {
  assert.equal(await rowCount(), 7);
  const h = await headers();
  assert.deepEqual(h.slice(0, 3), ["Code", "Indicator", "Sep"]);
  assert.equal(await val(0, "Sep"), "100");
  assert.equal(await val(1, "Sep"), "40");
  assert.equal(await val(2, "Sep"), "—", "no earlier value shows a dash, never 0");
});

await check("typing commits on Enter, moves down, and fills the running total of a SUM indicator", async () => {
  await type(0, "This period", "250");
  assert.equal(await val(0, "This period"), "250");
  assert.equal(await val(0, "Cumulative"), "650");
  assert.equal(await grid.getAttribute("aria-activedescendant"), `sheet-cell-1-${await col("This period")}`);
});

await check("the sheet saves by itself after a pause, with the version it was loaded at, and says when", async () => {
  await page.waitForFunction(() => window.__h.saves.length === 1, null, { timeout: 8000 });
  const [save] = (await H()).saves;
  assert.equal(save.periodId, "per1");
  assert.deepEqual(save.rows.map((r) => [r.indicatorId, r.periodAchievement, r.cumulativeAchievement, r.expectedUpdatedAt]), [["a", "250", "650", "2026-10-01T00:00:00.000Z"]]);
  await page.waitForFunction(() => /Saved/.test(document.querySelector('[data-testid="autosave"]')?.textContent ?? ""));
  assert.ok((await H()).refreshes >= 1, "the page is refreshed so the new version is loaded");
});

await reset();
await check("an impossible value is never saved by itself; fixing it lets the save go through", async () => {
  await type(1, "This period", "abc");
  await page.waitForTimeout(3600);
  assert.equal((await H()).saves.length, 0);
  assert.match(await status(), /Not saved: fix/);
  await type(1, "This period", "12");
  await page.waitForFunction(() => window.__h.saves.length === 1, null, { timeout: 8000 });
});

await reset();
await check("a save the server refuses is reported once and not retried until something changes", async () => {
  await page.evaluate(() => { window.__h.failNext = "OUT-2 was changed by someone else."; });
  await type(1, "This period", "7");
  await page.waitForFunction(() => /Could not save automatically/.test(document.querySelector('[data-testid="autosave"]')?.textContent ?? ""), null, { timeout: 8000 });
  assert.match(await status(), /changed by someone else/);
  await page.waitForTimeout(6000);
  assert.equal((await H()).saves.length, 0, "no retry loop");
  await type(1, "This period", "8");
  await page.waitForFunction(() => window.__h.saves.length === 1, null, { timeout: 8000 });
});

await reset();
await check("offline, the save is kept on the device in the outbox, once, and the screen says so", async () => {
  await context.setOffline(true);
  await type(1, "This period", "9");
  await page.waitForFunction(() => window.__h.enqueued.length === 1, null, { timeout: 8000 });
  const [entry] = (await H()).enqueued;
  assert.equal(entry.kind, "indicator-values");
  assert.equal(entry.payload.periodId, "per1");
  assert.equal(entry.payload.rows[0].periodAchievement, "9");
  assert.match(await status(), /Saved on this device/);
  await page.waitForTimeout(3500);
  assert.equal((await H()).enqueued.length, 1, "the same save is not queued twice");
  assert.equal((await H()).saves.length, 0);
});

await reset();
await check("with automatic saving off nothing is saved until Save all", async () => {
  await page.getByLabel("Save automatically").uncheck();
  await type(1, "This period", "3");
  await page.waitForTimeout(3600);
  assert.equal((await H()).saves.length, 0);
  await page.getByRole("button", { name: "Save all" }).click();
  await page.waitForFunction(() => window.__h.saves.length === 1);
});

await reset();
await page.getByLabel("Save automatically").uncheck();

await check("filters, sorting and search choose the rows; a row stays put while you type in it", async () => {
  await page.getByLabel("Show").selectOption("LOCKED");
  assert.equal(await rowCount(), 2, "the verified row and the calculated one");
  await page.getByLabel("Show").selectOption("OPEN");
  assert.equal(await rowCount(), 5);
  await page.getByLabel("Show").selectOption("EMPTY");
  const before = await rowCount();
  await type(1, "This period", "4");
  assert.equal(await rowCount(), before, "typing does not make the row jump away");
  await page.getByLabel("Show").selectOption("ALL");
  await page.getByLabel("Order").selectOption("CODE");
  assert.equal(await cell(0, 0).innerText(), "OUT-1");
  await page.getByLabel("Search indicators").fill("kits");
  assert.equal(await rowCount(), 1);
  await page.getByLabel("Search indicators").fill("");
  await page.getByLabel("Order").selectOption("LEVEL");
});

await check("Ctrl+F finds a cell and Ctrl+G goes to a code or a cell reference", async () => {
  await cell(0, await col("This period")).click();
  await page.keyboard.press("Control+f");
  await page.getByPlaceholder("Find in the sheet").fill("handed in");
  await page.keyboard.press("Enter");
  assert.equal(await grid.getAttribute("aria-activedescendant"), `sheet-cell-6-1`);
  await page.keyboard.press("Escape");
  await grid.focus();
  await page.keyboard.press("Control+g");
  await page.getByPlaceholder("Code or cell, e.g. OUT-3 or F12").fill("OUT-3");
  await page.keyboard.press("Enter");
  assert.equal(await grid.getAttribute("aria-activedescendant"), `sheet-cell-2-${await col("This period")}`);
});

await check("columns can be hidden and moved; the choice survives a reload", async () => {
  const had = (await headers()).length;
  await page.getByRole("button", { name: "Columns", exact: true }).click();
  await page.getByLabel("Baseline", { exact: true }).uncheck();
  assert.equal((await headers()).length, had - 1);
  await page.getByRole("button", { name: "Move left: Notes" }).click();
  const h = await headers();
  assert.ok(h.indexOf("Notes") < h.indexOf("Cumulative"));
  await reset({ keepStorage: true });
  const again = await headers();
  assert.ok(!again.includes("Baseline"), "hidden column stays hidden");
  assert.ok(again.indexOf("Notes") < again.indexOf("Cumulative"), "order stays");
  await page.getByRole("button", { name: "Columns", exact: true }).click();
  await page.getByRole("button", { name: "Reset columns" }).click();
  assert.ok((await headers()).includes("Baseline"));
  await page.getByLabel("Save automatically").uncheck();
});

await check("a column can be resized by dragging its edge, and zoom and row height change the view", async () => {
  const idx = await col("Notes");
  const w0 = (await page.locator('[role="columnheader"]').nth(idx).boundingBox()).width;
  const handle = page.locator('[role="columnheader"]').nth(idx).locator('[role="separator"]');
  const box = await handle.boundingBox();
  await page.mouse.move(box.x + 2, box.y + 8);
  await page.mouse.down();
  await page.mouse.move(box.x + 82, box.y + 8, { steps: 6 });
  await page.mouse.up();
  const w1 = (await page.locator('[role="columnheader"]').nth(idx).boundingBox()).width;
  assert.ok(w1 > w0 + 50, `${w0} -> ${w1}`);
  const rowH = async () => (await cell(1, 0).boundingBox()).height;
  const comfortable = await rowH();
  await page.getByLabel("Row height").selectOption("compact");
  assert.ok((await rowH()) < comfortable);
  await page.getByRole("button", { name: "Zoom in" }).click();
  assert.ok(await page.getByText("Zoom 105%").isVisible());
});

await reset();
await page.getByLabel("Save automatically").uncheck();

await check("dragging the fill handle copies the value down and skips locked rows", async () => {
  const pe = await col("This period");
  await type(1, "This period", "8");
  await cell(1, pe).click();
  const handle = cell(1, pe).locator('[data-testid="fill-handle"]');
  const hb = await handle.boundingBox();
  const target = await cell(4, pe).boundingBox();
  await page.mouse.move(hb.x + 3, hb.y + 3);
  await page.mouse.down();
  await page.mouse.move(target.x + 10, target.y + 10, { steps: 8 });
  await page.mouse.up();
  assert.equal(await val(3, "This period"), "8");
  assert.equal(await val(2, "This period"), "5", "the verified row is untouched");
  assert.equal(await val(4, "This period"), "", "the calculated row is untouched");
});

await check("the row under the cursor shows its history and comment button; history loads when opened", async () => {
  await cell(0, await col("This period")).click();
  await page.getByText("History of this value").click();
  await page.getByText("empty → 10").waitFor();
  assert.deepEqual((await H()).historyCalls, ["u-a"]);
  assert.equal(await page.getByTestId("comments").getAttribute("data-entity"), "indicator_update:u-a");
  await cell(1, await col("This period")).click();
  assert.match(await page.locator("section[aria-label^='Details for']").innerText(), /Save the value first to comment/);
});

await check("by place: known places are rows, pasted place and value lines fill them, new places are named, and a total mismatch is said", async () => {
  await cell(1, await col("This period")).click();
  await page.getByText("By place", { exact: true }).click();
  await page.locator("table[aria-label^='By place'] tbody tr").first().waitFor();
  assert.equal(await page.locator("table[aria-label^='By place'] tbody tr").count(), 2);
  await page.evaluate(() => {
    const dt = new DataTransfer(); dt.setData("text/plain", "Rabak\t5\nSinja\t7\nKosti\tmany");
    document.querySelector("table[aria-label^='By place']").parentElement.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  assert.equal(await page.locator("table[aria-label^='By place'] tbody tr").count(), 3);
  assert.equal(await page.getByLabel("Rabak Value").inputValue(), "5");
  assert.equal(await page.getByLabel("Sinja Value").inputValue(), "7");
  assert.match(await page.locator("[role=status]").last().innerText(), /Places added: 1|not a number/);
  assert.match(await page.locator("section[aria-label^='Details for']").innerText(), /Places add up to 12/);
});

await check("Verify selected acts on the saved, unverified rows in the selection only", async () => {
  await cell(0, await col("This period")).click();
  await page.keyboard.down("Shift");
  await cell(6, await col("This period")).click();
  await page.keyboard.up("Shift");
  const button = page.getByRole("button", { name: /Verify selected/ });
  assert.match(await button.innerText(), /\(2\)/, "OUT-1 (draft) and OUT-7 (handed in); the verified one is not counted");
  await button.click();
  await page.waitForFunction(() => window.__h.verified.length === 1);
  assert.deepEqual((await H()).verified[0].ids.sort(), ["u-a", "u-g"]);
});

await reset();
await page.getByLabel("Save automatically").uncheck();

await check("Excel: a download link, and an imported file previews, skips locked and unknown rows, and fills the grid", async () => {
  assert.equal(await page.getByRole("link", { name: "Download Excel" }).getAttribute("href"), "/api/reporting-periods/per1/indicator-sheet/export");
  await page.evaluate(() => {
    window.__h.parse = { warnings: ['Indicator code "GHOST" does not exist in this project\'s logframe.'], rows: [
      { indicatorId: "b", code: "OUT-2", name: "Kits distributed", periodAchievement: "30", cumulativeAchievement: "30", comments: "from excel", dataSource: "", matched: true, locked: false },
      { indicatorId: "c", code: "OUT-3", name: "Verified row", periodAchievement: "99", cumulativeAchievement: "99", comments: "", dataSource: "", matched: true, locked: true },
      { indicatorId: null, code: "GHOST", name: null, periodAchievement: "1", cumulativeAchievement: "", comments: "", dataSource: "", matched: false, locked: false },
    ] };
  });
  await page.locator('input[type="file"]').setInputFiles({ name: "values.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: Buffer.from("x") });
  await page.getByText("(locked, not applied)").waitFor();
  assert.equal((await H()).workbookCalls, 1);
  await page.getByRole("button", { name: "Apply 1 to grid" }).click();
  assert.equal(await val(1, "This period"), "30");
  assert.equal(await val(1, "Notes"), "from excel");
  assert.equal(await val(2, "This period"), "5", "a locked row is never changed by an import");
});

if (process.env.SHEET_SHOT) {
  await reset();
  await page.getByLabel("Save automatically").uncheck();
  await type(0, "This period", "250");
  await cell(1, await col("This period")).click();
  await page.getByText("By place", { exact: true }).click();
  await page.screenshot({ path: process.env.SHEET_SHOT, fullPage: true });
}
console.log(results.join("\n"));
console.log("page errors:", errors.length ? [...new Set(errors)].join("\n  ") : "none");
await browser.close();
process.exit(results.some((r) => r.startsWith("FAIL")) || errors.length > 0 ? 1 : 0);
