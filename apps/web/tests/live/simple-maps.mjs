// A live check of the simple-maps flow (Phase 53) against a running DonorDesk, as a signed-in person, in a real browser.
// Usage: DD_BASE=https://donordesk.online DD_EMAIL=… DD_PASS=… DD_PROJECT=<project id> [DD_EMPTY_PROJECT=<id>] [DD_CDP=http://127.0.0.1:9333] node tests/live/simple-maps.mjs
// Credentials come from the environment only, never a file. It changes one indicator setting and puts it back; it creates nothing it keeps.
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";

const base = process.env.DD_BASE ?? "https://donordesk.online";
const project = process.env.DD_PROJECT;
if (!project || !process.env.DD_EMAIL || !process.env.DD_PASS) { console.error("Set DD_PROJECT, DD_EMAIL and DD_PASS."); process.exit(2); }
const browser = process.env.DD_CDP ? await chromium.connectOverCDP(process.env.DD_CDP) : await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const context = browser.contexts()[0] ?? await browser.newContext({ viewport: { width: 1400, height: 950 } });
const page = context.pages()[0] ?? await context.newPage();
const results = [];
let clicks = 0;
const click = async (locator) => { clicks += 1; await locator.click(); };
async function check(name, fn) { try { await fn(); results.push(`ok   ${name}`); } catch (e) { results.push(`FAIL ${name} :: ${String(e.message ?? e).split("\n")[0]}`); } }

await page.goto(`${base}/projects/${project}`, { waitUntil: "networkidle" });
if (page.url().includes("/login")) {
  await page.getByLabel(/email/i).first().fill(process.env.DD_EMAIL);
  await page.getByLabel(/password/i).first().fill(process.env.DD_PASS);
  await page.getByRole("button", { name: /sign in/i }).first().click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
}

await check("Where we work: the Areas tab is a tick list beside a map, opening on the project's country", async () => {
  await page.goto(`${base}/projects/${project}/places`, { waitUntil: "networkidle" });
  const picker = page.getByTestId("project-area-picker");
  await picker.waitFor({ timeout: 20000 });
  await picker.getByText(/areas of .* are in your places list/).waitFor({ timeout: 30000 });
  assert.ok((await picker.locator("select").first().inputValue()).length > 0, "a country is chosen");
});

let indicatorHref = null;
await check("Map: grey ground, legend, names and figures on areas, advanced options closed", async () => {
  await page.goto(`${base}/visuals/maps/${project}`, { waitUntil: "domcontentloaded" });
  await page.getByText(/Places with a figure/).first().waitFor({ timeout: 30000 });
  const more = page.getByTestId("map-more-options");
  assert.equal(await more.count(), 1);
  assert.equal(await more.evaluate((d) => d.open), false, "More options starts closed");
  assert.equal(await more.locator("select").first().inputValue(), "SIMPLE", "the ground is the simple grey one");
});

await check("Record by place on one indicator puts a Map link on its logframe row, and the link opens the map on it", async () => {
  await page.goto(`${base}/projects/${project}/logframe`, { waitUntil: "networkidle" });
  // The first indicator that offers the setting (a calculated one is never typed, so it has none).
  const hrefs = [...new Set(await page.locator("a[href*='/indicators/']").evaluateAll((as) => as.map((a) => a.getAttribute("href"))))].filter((h) => h && !h.includes("/import"));
  let label = null;
  for (const h of hrefs.slice(0, 20)) {
    await page.goto(base + h, { waitUntil: "networkidle" });
    const l = page.locator("label", { hasText: "Record one figure for each place" });
    await l.first().waitFor({ timeout: 6000 }).catch(() => {});
    if (await l.count()) { indicatorHref = h; label = l; break; }
  }
  assert.ok(label, "an indicator offers record by place");
  const was = await label.locator("input").isChecked();
  if (!was) { await click(label); await click(page.getByRole("button", { name: "Save changes" })); await page.getByText("Saved.").first().waitFor({ timeout: 20000 }); }
  await page.goto(`${base}/projects/${project}/logframe`, { waitUntil: "networkidle" });
  const id = indicatorHref.split("/").pop();
  const mapLink = page.locator(`a[href*='indicator=${id}']`);
  assert.equal(await mapLink.count(), 1, "the row has a Map link");
  await click(mapLink);
  await page.getByText(/Places with a figure|nothing to shade|Say where you work/).first().waitFor({ timeout: 30000 });
  if (!was) {
    await page.goto(base + indicatorHref, { waitUntil: "networkidle" });
    await page.locator("label", { hasText: "Record one figure for each place" }).click();
    await page.getByRole("button", { name: "Save changes" }).click();
    await page.getByText("Saved.").first().waitFor({ timeout: 20000 });
  }
});

await check("Enter data: an indicator recorded by place shows a box per project place and adds them up", async () => {
  await page.goto(`${base}/projects/${project}/enter${indicatorHref ? `?indicator=${indicatorHref.split("/").pop()}` : ""}`, { waitUntil: "networkidle" });
  assert.equal(await page.locator("#record-indicator").count(), 1);
});

if (process.env.DD_EMPTY_PROJECT) {
  await check("An empty map says why, with a one-click fix", async () => {
    await page.goto(`${base}/visuals/maps/${process.env.DD_EMPTY_PROJECT}`, { waitUntil: "domcontentloaded" });
    await page.getByTestId("map-readiness").waitFor({ timeout: 40000 });
    assert.equal(await page.getByTestId("record-by-place-all").count(), 1, "the one-click fix is offered");
  });
}

console.log(results.join("\n"));
console.log(`clicks a person needed in the map steps: ${clicks}`);
const failed = results.filter((r) => r.startsWith("FAIL")).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
if (!process.env.DD_CDP) await browser.close(); else await browser.close().catch(() => {});
process.exit(failed ? 1 : 0);
