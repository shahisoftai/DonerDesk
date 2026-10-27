// Opens a VISIBLE browser, logs in as the demo-tenant user, and walks the maps feature.
// The browser stays open for the user to explore.
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:3000";
const NUTRITION = "1f02b38c-a60c-410d-8497-669c85e2fde4";
const HEALTH = "3d2fceac-e634-4f00-ac7b-b0a64eda57b3";
mkdirSync("/tmp/kilo/shots", { recursive: true });

const browser = await chromium.launch({ headless: false, slowMo: 150 });
const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
page.on("pageerror", (e) => console.log("PAGEERROR:", e.message.slice(0, 160)));

// 1. Login as the demo tenant user.
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill("#email", "mnpiracha@gmail.com");
await page.fill("#password", "Shahikhail@@0011");
await page.click('button[type="submit"]');
await page.waitForURL(/dashboard|projects|onboarding/, { timeout: 30000 });
console.log("LOGIN_OK ->", page.url());

// 2. First login on a fresh workspace: accept the Terms through the real onboarding page.
await page.goto(`${BASE}/onboarding`, { waitUntil: "networkidle" });
const accept = page.locator("button", { hasText: "Accept and finish setup" }).first();
if (await accept.count()) {
  const box = page.locator('input[type="checkbox"]').first();
  if (await box.count()) await box.check();
  await accept.click();
  await page.waitForTimeout(2500);
  console.log("CONSENT_ACCEPTED ->", page.url());
}

// 3. Overview of the Nutrition program: the "Where we work" map.
await page.goto(`${BASE}/projects/${NUTRITION}`, { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForLoadState("networkidle", { timeout: 90000 }).catch(() => {});
console.log("OVERVIEW_URL:", page.url());
const section = page.locator('section[aria-label="Where we work"]');
await section.waitFor({ timeout: 90000 });
await section.locator("canvas").waitFor({ timeout: 60000 });
await page.waitForTimeout(3500);
console.log("OVERVIEW_MAP_DRAWN");
await section.screenshot({ path: "/tmp/kilo/shots/demo-overview-location.png" });

// 4. Activities page: the Map view beside List and Timeline.
await page.goto(`${BASE}/projects/${NUTRITION}/activities`, { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForLoadState("networkidle", { timeout: 90000 }).catch(() => {});
await page.locator('[role="group"][aria-label="View"]').locator("button", { hasText: "Map" }).first().click({ timeout: 60000 });
await page.locator("canvas").first().waitFor({ timeout: 30000 });
await page.waitForTimeout(3500);
console.log("PLAN_MAP_DRAWN");
await page.screenshot({ path: "/tmp/kilo/shots/demo-plan-map.png" });

// 5. The health project's map (different sites, one deliberately unmapped row).
await page.goto(`${BASE}/projects/${HEALTH}/activities`, { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForLoadState("networkidle", { timeout: 90000 }).catch(() => {});
await page.locator('[role="group"][aria-label="View"]').locator("button", { hasText: "Map" }).first().click({ timeout: 60000 });
await page.locator("canvas").first().waitFor({ timeout: 30000 });
await page.waitForTimeout(3500);
console.log("HEALTH_MAP_DRAWN");

// 6. Leave the Overview of the health project open for the user to explore.
await page.goto(`${BASE}/projects/${HEALTH}`, { waitUntil: "networkidle" });
await page.locator('section[aria-label="Where we work"]').waitFor({ timeout: 30000 });
console.log("READY: browser left open — explore the maps");
console.log("SHOTS: /tmp/kilo/shots/demo-overview-location.png, demo-plan-map.png");

// Keep the browser alive for the user.
await new Promise(() => {});
