// A real-browser check of Home's grid and the arrange list (the real HomeGrid, HomeLayoutEditor and layout rules; only the server actions and the router are stubbed).
//   pnpm --filter @donordesk/web test:home-layout
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
const out = mkdtempSync(join(tmpdir(), "home-layout-"));
await build(join(out, "bundle.js"));
execFileSync("npx", ["tailwindcss", "-c", "tailwind.config.ts", "-i", "src/app/globals.css", "-o", join(out, "styles.css")], { cwd: web, stdio: "ignore" });
writeFileSync(join(out, "index.html"), '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="styles.css"></head><body><div id="root"></div><script src="bundle.js"></script></body></html>');
const base = `file://${join(out, "index.html")}`;

const browser = await chromium.launch();
const errors = [];
const results = [];
const check = async (name, fn) => { try { await fn(); results.push(`ok   ${name}`); } catch (e) { results.push(`FAIL ${name} :: ${String(e.message).split("\n").slice(0, 8).join(" ")}`); } };
async function open(hash = "", width = 1300) {
  const page = await (await browser.newContext({ viewport: { width, height: 1000 } })).newPage();
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); });
  await page.goto(base + (hash ? `#${hash}` : ""));
  await page.getByTestId("grid").waitFor();
  return page;
}
const titles = (page) => page.getByTestId("grid").locator("section").evaluateAll((els) => els.map((e) => (e.querySelector("h2")?.textContent ?? e.getAttribute("aria-label") ?? "").trim()));
const box = (page, title) => page.getByTestId("grid").locator(`section:has(h2:text-is("${title}")), section[aria-label="${title}"]`).first().evaluate((e) => { const r = e.parentElement.getBoundingClientRect(); const s = e.getBoundingClientRect(); return { w: r.width, x: r.x, y: r.y, h: s.height }; });

let page = await open();
await check("the default order puts heavy panels first and pairs panels of similar height", async () => {
  const t = await titles(page);
  assert.deepEqual(t.slice(0, 7), ["Headline figures", "Funding", "Where we work", "Projects by …", "Project health", "Upcoming reports", "Report pipeline"]);
  const a = await box(page, "Project health"), b = await box(page, "Upcoming reports");
  assert.ok(Math.abs(a.y - b.y) < 2, "side by side");
  assert.ok(a.w > b.w * 1.8 && a.w < b.w * 2.2, `two thirds and one third: ${a.w} / ${b.w}`);
});

await check("from a laptop up the shares are 12 columns; on a phone every panel is full width in the same order", async () => {
  const phone = await open("", 390);
  const widths = await phone.getByTestId("grid").locator(":scope > div").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().width)));
  assert.ok(new Set(widths).size === 1, `all one width: ${widths}`);
  const noScroll = await phone.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  assert.ok(noScroll, "no sideways scroll");
});

await check("a panel with nothing to show is a slim line and does not stretch to its taller neighbour", async () => {
  const poor = await open("data=poor");
  const health = await box(poor, "Project health"), upcoming = await box(poor, "Upcoming reports");
  assert.ok(Math.abs(health.y - upcoming.y) < 2, "same row");
  assert.ok(health.h > 200, `the health table is tall: ${health.h}`);
  assert.ok(upcoming.h < 70, `the empty panel is a slim line, not a tall card: ${upcoming.h}`);
});

await check("the arrange list names every panel, offers only the widths a panel allows, and starts with nothing to save", async () => {
  await page.getByRole("button", { name: "Arrange Home" }).click();
  const list = page.getByRole("region", { name: "Arrange Home" });
  assert.equal(await list.locator("ol > li").count(), 14, "a manager has no Grants panel");
  assert.equal(await list.getByRole("button", { name: "Save arrangement" }).isDisabled(), true);
  assert.equal(await list.getByLabel("Width: Headline figures").count(), 0, "headline figures only has one width");
  const opts = await list.getByLabel("Width: Risks and problems").locator("option").allInnerTexts();
  assert.deepEqual(opts, ["Narrow", "Half", "Wide", "Full width"]);
  assert.equal(await list.getByRole("button", { name: "Back to the default" }).count(), 0, "already the default");
  assert.equal(await list.getByRole("button", { name: "Move Headline figures earlier" }).isDisabled(), true);
});

await check("moving, narrowing and hiding then Save sends exactly the arrangement, from version none, and refreshes", async () => {
  const list = page.getByRole("region", { name: "Arrange Home" });
  await list.getByRole("button", { name: "Move Risks and problems earlier" }).click();
  await list.getByLabel("Width: Risks and problems").selectOption("8");
  await list.getByRole("checkbox", { name: /Where we work/ }).uncheck();
  await list.getByRole("button", { name: "Save arrangement" }).click();
  await page.waitForFunction(() => window.__h.saves.length === 1);
  const sent = await page.evaluate(() => window.__h.saves[0]);
  assert.equal(sent.variant, "MANAGER");
  assert.equal(sent.expectedUpdatedAt, null);
  const keys = sent.layout.map((p) => p.key);
  assert.ok(keys.indexOf("RISKS") < keys.indexOf("RESULTS"), "risks moved before results");
  assert.deepEqual(sent.layout.find((p) => p.key === "RISKS"), { key: "RISKS", span: 8, hidden: false });
  assert.equal(sent.layout.find((p) => p.key === "MAP").hidden, true);
  assert.equal(sent.layout.length, 14);
  assert.equal(await page.evaluate(() => window.__h.refreshes), 1);
});

await check("a saved arrangement is what Home shows: reordered, a hidden panel left out and no gap where it was", async () => {
  const saved = await open("layout=saved");
  const t = await titles(saved);
  assert.equal(t[0], "Risks and problems");
  assert.ok(!t.includes("Where we work"), "hidden panel is not drawn");
  assert.equal(t.length, 13, "every other panel is still there, including ones the layout did not mention");
  assert.ok(t.includes("Quick links"));
});

await check("Cancel drops the edit; a saved layout offers a way back to the default, which asks the server to reset", async () => {
  const saved = await open("layout=saved");
  await saved.getByRole("button", { name: "Arrange Home" }).click();
  const list = saved.getByRole("region", { name: "Arrange Home" });
  await list.getByRole("button", { name: "Move Headline figures earlier" }).waitFor();
  await list.getByRole("checkbox", { name: /Funding/ }).uncheck();
  await list.getByRole("button", { name: "Cancel" }).click();
  assert.ok((await titles(saved)).includes("Funding"), "the unsaved edit changed nothing");
  await saved.getByRole("button", { name: "Arrange Home" }).click();
  assert.equal(await saved.getByRole("checkbox", { name: /Funding/ }).isChecked(), true, "and it was dropped, not kept");
  await saved.getByRole("button", { name: "Back to the default" }).click();
  await saved.waitForFunction(() => window.__h.resets.length === 1);
  assert.deepEqual(await saved.evaluate(() => window.__h.resets), ["MANAGER"]);
  assert.equal(await saved.evaluate(() => window.__h.saves.length), 0);
});

await check("a save refused because Home was arranged elsewhere says so, stays open and keeps the person's edit", async () => {
  const p = await open("layout=saved");
  await p.evaluate(() => { window.__h.saveAnswer = { ok: false, error: { kind: "conflict", message: "Your Home was arranged somewhere else since you opened it. Nothing was saved. Reload the page to see that version, then make your changes again." } }; });
  await p.getByRole("button", { name: "Arrange Home" }).click();
  const list = p.getByRole("region", { name: "Arrange Home" });
  await list.getByRole("checkbox", { name: /Funding/ }).uncheck();
  await list.getByRole("button", { name: "Save arrangement" }).click();
  await list.getByRole("alert").waitFor();
  assert.match(await list.getByRole("alert").innerText(), /arranged somewhere else/);
  assert.equal(await list.getByRole("checkbox", { name: /Funding/ }).isChecked(), false, "the edit is still there");
  assert.equal((await p.evaluate(() => window.__h.saves[0])).expectedUpdatedAt, "2026-11-04T00:00:00.000Z", "it saved from the version it opened");
});

await check("every control is reachable by name for a keyboard or screen reader user", async () => {
  const p = await open();
  await p.getByRole("button", { name: "Arrange Home" }).click();
  const list = p.getByRole("region", { name: "Arrange Home" });
  const unnamed = await list.locator("button, select, input").evaluateAll((els) => els.filter((e) => !(e.getAttribute("aria-label") || e.labels?.[0]?.textContent?.trim() || e.textContent?.trim())).length);
  assert.equal(unnamed, 0);
  await list.getByRole("button", { name: "Move Funding later" }).focus();
  await p.keyboard.press("Enter");
  assert.equal((await list.locator("ol > li").nth(2).innerText()).includes("Funding"), true, "Enter on a focused move button moves the panel");
});

await browser.close();
console.log(results.join("\n"));
if (errors.length) console.log("page errors:", [...new Set(errors)].join(" | "));
if (results.some((r) => r.startsWith("FAIL")) || errors.length) process.exit(1);
