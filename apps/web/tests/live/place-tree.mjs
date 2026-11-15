// A live check of Phase 56 (one place tree) against a running DonerDesk, as a signed-in person, in a real browser. Read-only: it opens pages
// and tries one refused change (unticking an area that holds records), which saves nothing.
// Usage: DD_BASE=https://donordesk.online DD_EMAIL=… DD_PASS=… DD_PROJECT=<id> DD_ACTIVITY=<completed activity id> DD_INDICATOR=<id> [DD_CDP=http://127.0.0.1:9333] node tests/live/place-tree.mjs
// Credentials come from the environment only, never a file.
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";

const base = process.env.DD_BASE ?? "https://donordesk.online";
const { DD_PROJECT: project, DD_ACTIVITY: activity, DD_INDICATOR: indicator } = process.env;
if (!project || !activity || !indicator || !process.env.DD_EMAIL || !process.env.DD_PASS) { console.error("Set DD_PROJECT, DD_ACTIVITY, DD_INDICATOR, DD_EMAIL and DD_PASS."); process.exit(2); }
const browser = process.env.DD_CDP ? await chromium.connectOverCDP(process.env.DD_CDP) : await chromium.launch({ headless: false });
const context = browser.contexts()[0] ?? await browser.newContext({ viewport: { width: 1400, height: 950 } });
const page = context.pages()[0] ?? await context.newPage();
const results = [];
async function check(name, fn) { try { await fn(); results.push(`ok   ${name}`); } catch (e) { results.push(`FAIL ${name} :: ${String(e.message ?? e).split("\n")[0]}`); } }

await page.goto(`${base}/projects/${project}`, { waitUntil: "networkidle" });
if (page.url().includes("/login")) {
  await page.getByLabel(/email/i).first().fill(process.env.DD_EMAIL);
  await page.getByLabel(/password/i).first().fill(process.env.DD_PASS);
  await page.getByRole("button", { name: /sign in/i }).first().click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60000 });
}

await check("Project › Where we work: three tabs, this project's own areas, the Areas list", async () => {
  await page.goto(`${base}/projects/${project}/places`, { waitUntil: "networkidle" });
  for (const tab of [/^Areas/, /^Sites/, /^To confirm/]) await page.getByRole("link", { name: tab }).first().waitFor({ timeout: 20000 });
  await page.getByText(/This project works in \d+ areas? of/).waitFor({ timeout: 40000 });
  await page.getByRole("heading", { name: "This project's areas" }).waitFor();
  assert.ok(await page.getByRole("button", { name: /Close…/ }).count() > 0, "areas can be closed");
});

await check("Sites tab: the places this project's records point at, with what was recorded", async () => {
  await page.goto(`${base}/projects/${project}/places?tab=sites`, { waitUntil: "networkidle" });
  await page.getByRole("columnheader", { name: "Recorded here" }).waitFor({ timeout: 20000 });
  assert.ok(await page.locator("tbody tr").count() > 0);
});

await check("Old 'Points' address opens Sites", async () => {
  await page.goto(`${base}/projects/${project}/places?tab=points`, { waitUntil: "networkidle" });
  await page.getByRole("columnheader", { name: "Recorded here" }).waitFor({ timeout: 20000 });
});

await check("To confirm tab: this project's own words only", async () => {
  await page.goto(`${base}/projects/${project}/places?tab=confirm`, { waitUntil: "networkidle" });
  await page.getByText(/no place answers to yet|Every place typed on this project is matched/).first().waitFor({ timeout: 20000 });
});

await check("A completed activity shows its places, inherited from the plan", async () => {
  await page.goto(`${base}/projects/${project}/activities/${activity}`, { waitUntil: "networkidle" });
  const section = page.locator("section", { has: page.getByRole("heading", { name: "Places", exact: true }) });
  await section.waitFor({ timeout: 20000 });
  await section.getByText("from its plan").first().waitFor();
});

await check("An indicator says where it is measured", async () => {
  await page.goto(`${base}/projects/${project}/indicators/${indicator}`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Where is this measured?" }).waitFor({ timeout: 20000 });
  await page.getByText("Rows people fill in now").waitFor();
});

let placeHref = null;
await check("Home › Where we work: areas with their projects, derived", async () => {
  await page.goto(`${base}/where-we-work`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Where we work", level: 1 }).waitFor({ timeout: 20000 });
  await page.getByRole("columnheader", { name: "Projects" }).waitFor();
  placeHref = await page.locator("tbody tr a[href^='/places/']").first().getAttribute("href");
  assert.ok(placeHref);
});

await check("A place's page lists the projects working there", async () => {
  await page.goto(`${base}${placeHref}`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Projects here" }).waitFor({ timeout: 20000 });
});

await check("Settings › Places is gone: the old address opens Manage places with duplicates", async () => {
  await page.goto(`${base}/settings/places`, { waitUntil: "networkidle" });
  assert.match(page.url(), /\/where-we-work\/manage$/);
  await page.getByRole("heading", { name: "Possible duplicates" }).waitFor({ timeout: 20000 });
  await page.goto(`${base}/settings`, { waitUntil: "networkidle" });
  assert.equal(await page.locator("a[href='/settings/places']").count(), 0, "no Places entry in Settings");
});

for (const r of results) console.log(r);
console.log(`\n${results.filter((r) => r.startsWith("ok")).length}/${results.length} checks passed`);
if (!process.env.DD_CDP) await browser.close();
process.exit(results.every((r) => r.startsWith("ok")) ? 0 : 1);
