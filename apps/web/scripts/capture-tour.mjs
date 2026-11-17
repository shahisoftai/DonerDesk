#!/usr/bin/env node
/**
 * Captures one screenshot per public-tour scene (`src/features/tour/domain/public-tour-scenes.ts`) from the clean tour tenant and
 * writes `public/tour/<scene>.jpg` + `src/features/tour/domain/tour-shots.json` (spotlight rectangle per scene, as fractions of the
 * viewport). The /tour page draws these, so what visitors see is the real portal.
 *
 * Run it with `node --experimental-strip-types`, credentials from the environment only (never commit them):
 *   TOUR_EMAIL=… TOUR_PASSWORD=…            the project manager of the tour tenant (desktop scenes)
 *   TOUR_FIELD_EMAIL=… TOUR_FIELD_PASSWORD=…  a field officer of the same tenant (phone scenes)
 *   [TOUR_BASE_URL=https://donordesk.online] [TOUR_PROJECT="<project title>"] [TOUR_ONLY=entry-sheet,forms]
 *   [TOUR_FALLBACK=1]                       use each page's root element while the data-tour-id hooks are not deployed yet
 *   [TOUR_FORBID='regex']                   extra strings that must not appear on any captured page
 * Re-run whenever a tour screen changes. A scene whose page shows a forbidden string, or whose spotlight element is missing, is NOT
 * captured and is reported; the manifest is marked `captured` only when every scene succeeded.
 */
import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { TOUR_SCENES } from "../src/features/tour/domain/public-tour-scenes.ts";

const BASE = process.env.TOUR_BASE_URL ?? "https://donordesk.online";
const PROJECT = process.env.TOUR_PROJECT;
const ONLY = process.env.TOUR_ONLY ? new Set(process.env.TOUR_ONLY.split(",")) : null;
const FORBID = new RegExp(`DEMO-\\d|P25-CHECK|ZZ TEST|Najeeb|shahisoft|@gmail\\.com${process.env.TOUR_FORBID ? `|${process.env.TOUR_FORBID}` : ""}`, "i");
const LOGINS = {
  manager: { email: process.env.TOUR_EMAIL, password: process.env.TOUR_PASSWORD },
  field: { email: process.env.TOUR_FIELD_EMAIL, password: process.env.TOUR_FIELD_PASSWORD },
};
const SIZE = { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } };

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, "../public/tour");
const MANIFEST = path.join(here, "../src/features/tour/domain/tour-shots.json");
if (!PROJECT) throw new Error("Set TOUR_PROJECT to the tour tenant's project title");

const browser = await chromium.launch();
const sessions = {};
async function sessionFor(who, viewport) {
  const key = `${who}:${viewport}`;
  if (sessions[key]) return sessions[key];
  const { email, password } = LOGINS[who];
  if (!email || !password) return null;
  const size = SIZE[viewport];
  const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: viewport === "phone" ? 2 : 1, colorScheme: "light", locale: "en-GB" });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`);
  await page.fill("#email", email);
  await page.fill("#password", password);
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login")), page.click("button[type=submit]")]);
  return (sessions[key] = page);
}
const settle = (page) => page.waitForLoadState("networkidle").catch(() => {});

// Ids from the manager's session: the project, its first reporting period and the first dashboard.
const mgr = await sessionFor("manager", "desktop");
if (!mgr) throw new Error("Set TOUR_EMAIL and TOUR_PASSWORD");
await mgr.goto(`${BASE}/projects`); await settle(mgr);
const href = await mgr.locator(`a[href*="/projects/"]:has-text("${PROJECT}")`).first().getAttribute("href");
const projectId = href?.match(/\/projects\/([0-9a-f-]{36})/)?.[1];
if (!projectId) throw new Error(`Project "${PROJECT}" not found`);
await mgr.goto(`${BASE}/projects/${projectId}/reports`); await settle(mgr);
const hrefs = await mgr.locator('a[href*="/reports/"]').evaluateAll((as) => as.map((a) => a.getAttribute("href")));
// The list is newest first; the tour reads the earliest period (the one with figures).
const periodId = hrefs.map((h) => h?.match(/\/reports\/([0-9a-f-]{36})/)?.[1]).filter(Boolean).at(-1);
await mgr.goto(`${BASE}/visuals`); await settle(mgr);
const vh = await mgr.locator('a[href^="/visuals/"]').evaluateAll((as) => as.map((a) => a.getAttribute("href")));
const canvasId = vh.map((h) => h?.match(/^\/visuals\/([0-9a-f-]{36})/)?.[1]).find(Boolean);
const ids = { projectId, periodId, canvasId };

await mkdir(OUT, { recursive: true });
let manifest;
try { manifest = JSON.parse(await readFile(MANIFEST, "utf8")); } catch { manifest = { shots: {} }; }
manifest.size = SIZE;
const failed = [];

for (const scene of TOUR_SCENES) {
  if (ONLY && !ONLY.has(scene.id)) continue;
  const route = scene.route.replace(/\{(\w+)\}/g, (_, k) => ids[k] ?? `MISSING-${k}`);
  if (route.includes("MISSING-")) { failed.push(`${scene.id}: ${route}`); continue; }
  const page = await sessionFor(scene.as, scene.viewport);
  if (!page) { failed.push(`${scene.id}: no ${scene.as} login`); continue; }
  const size = SIZE[scene.viewport];
  await page.goto(`${BASE}${route}`); await settle(page);
  let el = page.locator(`[data-tour-id="${scene.hook}"]`).first();
  // TOUR_FALLBACK=1: before the hooks are deployed, use the page's root element, which is where each hook sits.
  if (!(await el.count()) && process.env.TOUR_FALLBACK) el = page.locator("main .animate-fade-in, main .page-stack, main, body").first();
  if (!(await el.count())) { failed.push(`${scene.id}: no [data-tour-id="${scene.hook}"] on ${route}`); continue; }
  await el.evaluate((n) => n.scrollIntoView({ block: "nearest" }));
  await page.waitForTimeout(600);
  const text = await page.locator("body").innerText();
  const bad = text.match(FORBID);
  if (bad) { failed.push(`${scene.id}: page shows "${bad[0]}"`); continue; }
  await page.screenshot({ path: path.join(OUT, `${scene.id}.jpg`), type: "jpeg", quality: 82 });
  // The spotlight is the target itself when it fits the screen; a page-sized target is narrowed to the largest block inside it that does.
  const rect = await el.evaluate((root, size) => {
    const vis = (n) => { const r = n.getBoundingClientRect(); const x = Math.max(0, r.left), y = Math.max(0, r.top), w = Math.min(r.right, size.width) - x, h = Math.min(r.bottom, size.height) - y; return w > 0 && h > 0 ? { x, y, w, h } : null; };
    const area = (r) => r.w * r.h, screen = size.width * size.height;
    const own = vis(root); if (!own) return null;
    if (area(own) <= 0.55 * screen) return own;
    let best = null;
    for (const n of root.querySelectorAll(":scope > *, :scope > * > *, :scope > * > * > *")) {
      const r = vis(n); if (!r || area(r) < 0.1 * screen || area(r) > 0.55 * screen || r.w < 0.4 * size.width) continue;
      if (!best || area(r) > area(best)) best = r;
    }
    return best ?? { x: own.x, y: own.y, w: own.w, h: Math.min(own.h, 140) };
  }, size);
  if (!rect) { failed.push(`${scene.id}: spotlight target is off screen`); continue; }
  manifest.shots[scene.id] = { x: rect.x / size.width, y: rect.y / size.height, w: rect.w / size.width, h: rect.h / size.height };
  console.log(`ok ${scene.id}`);
}

manifest.captured = TOUR_SCENES.every((s) => manifest.shots[s.id]) && failed.length === 0;
await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
await browser.close();
if (failed.length) { console.error(`\nNot captured:\n - ${failed.join("\n - ")}`); process.exit(1); }
console.log("\nAll scenes captured.");
