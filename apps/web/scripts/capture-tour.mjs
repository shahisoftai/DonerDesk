#!/usr/bin/env node
/**
 * Captures one screenshot per product-tour step from a real tenant and writes
 * `public/tour/{stepId}.jpg` + `src/features/tour/domain/tour-shots.json`
 * (spotlight rect per step, as fractions of the viewport). The public /tour
 * page renders these so visitors see the real portal behind each step.
 *
 * Usage:
 *   TOUR_EMAIL=... TOUR_PASSWORD=... [TOUR_BASE_URL=https://donordesk.online] \
 *   [TOUR_PROJECT="Nutrition Resilience"] node apps/web/scripts/capture-tour.mjs
 * Re-run whenever the UI of a tour step changes.
 */
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const BASE = process.env.TOUR_BASE_URL ?? "https://donordesk.online";
const EMAIL = process.env.TOUR_EMAIL;
const PASSWORD = process.env.TOUR_PASSWORD;
const PROJECT = process.env.TOUR_PROJECT ?? "Nutrition Resilience";
if (!EMAIL || !PASSWORD) throw new Error("Set TOUR_EMAIL and TOUR_PASSWORD");

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, "../public/tour");
const MANIFEST = path.join(here, "../src/features/tour/domain/tour-shots.json");
const W = 1440, H = 900;

// id, route suffix, selector to spotlight, optional fallback selector
const STEPS = [
  ["dashboard-demo-project", "@dashboard", '[data-tour-id="demo-project-card"]', "main"],
  ["project-setup", "/setup", '[data-tour-id="project-setup-checklist"]'],
  ["donor-template", "/templates", '[data-tour-id="donor-template-review"]'],
  ["logframe-indicators", "/logframe", '[data-tour-id="logframe-indicator-list"]'],
  ["evidence", "/evidence", '[data-tour-id="evidence-upload"]'],
  ["reporting-period", "/reports", '[data-tour-id="reporting-period-list"]'],
  ["ai-draft", "/reports/{P}", '[data-tour-id="generate-ai-draft"]', "#report-draft-actions, button:has-text('Regenerate')"],
  ["report-editor", "/reports/{P}", '[data-tour-id="report-editor"]'],
  ["compliance", "/compliance", '[data-tour-id="compliance-checklist"]'],
  ["export", "/reports/{P}/export", '[data-tour-id="export-report"]'],
];

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })).newPage();
const settle = () => page.waitForLoadState("networkidle").catch(() => {});

await page.goto(`${BASE}/login`);
await page.fill("#email", EMAIL);
await page.fill("#password", PASSWORD);
await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login")), page.click("button[type=submit]")]);

await page.goto(`${BASE}/projects`);
await settle();
const href = await page.locator(`a[href*="/projects/"]:has-text("${PROJECT}")`).first().getAttribute("href");
const projectId = href?.match(/\/projects\/([0-9a-f-]{36})/)?.[1];
if (!projectId) throw new Error(`Project "${PROJECT}" not found`);
await page.goto(`${BASE}/projects/${projectId}/reports`);
await settle();
const periodId = (await page.locator('a[href*="/reports/"]').evaluateAll((as) => as.map((a) => a.getAttribute("href")))).map((h) => h?.match(/\/reports\/([0-9a-f-]{36})/)?.[1]).find(Boolean);
if (!periodId) throw new Error("No reporting period found");

await mkdir(OUT, { recursive: true });
const shots = {};
for (const [id, route, selector, fallback] of STEPS) {
  await page.goto(route === "@dashboard" ? `${BASE}/dashboard` : `${BASE}/projects/${projectId}${route.replace("{P}", periodId)}`);
  await settle();
  let el = page.locator(selector).first();
  if (!(await el.count()) && fallback) el = page.locator(fallback).first();
  if (!(await el.count())) { console.warn(`! ${id}: target missing, skipped`); continue; }
  await el.evaluate((n) => n.scrollIntoView({ block: "nearest" }));
  await page.waitForTimeout(400);
  const box = await el.boundingBox();
  await page.screenshot({ path: path.join(OUT, `${id}.jpg`), type: "jpeg", quality: 80 });
  const pad = fallback ? 12 : 0;
  const x = Math.max(0, box.x - pad), y = Math.max(0, box.y - pad);
  const w = Math.min(box.width + 2 * pad, W - x), h = Math.min(box.height + 2 * pad, H - y);
  // A target that fills the viewport carries no information as a spotlight.
  shots[id] = w * h > 0.6 * W * H ? null : { x: x / W, y: y / H, w: w / W, h: h / H };
  console.log(`ok ${id}`, shots[id]);
}
await writeFile(MANIFEST, JSON.stringify({ width: W, height: H, shots }, null, 2) + "\n");
await browser.close();
