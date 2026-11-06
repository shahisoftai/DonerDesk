// Batch 30.1 demo on the VISIBLE browser: upload custom boundaries in Settings, then pin a place by hand.
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:3000";
const NUTRITION = "1f02b38c-a60c-410d-8497-669c85e2fde4";
mkdirSync("/tmp/kilo/shots", { recursive: true });

const browser = await chromium.launch({ headless: false, slowMo: 120 });
const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
page.on("pageerror", (e) => console.log("PAGEERROR:", e.message.slice(0, 160)));

await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill("#email", "mnpiracha@gmail.com");
await page.fill("#password", "Shahikhail@@0011");
await page.click('button[type="submit"]');
await page.waitForURL(/dashboard|projects|onboarding/, { timeout: 60000 });
console.log("LOGIN_OK");

// 1. Settings: upload the custom boundaries layer.
await page.goto(`${BASE}/settings`, { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForLoadState("networkidle", { timeout: 90000 }).catch(() => {});
const card = page.locator(".card", { hasText: "Custom map boundaries" }).first();
await card.waitFor({ timeout: 60000 });
const fileInput = card.locator('input[type="file"]');
await fileInput.setInputFiles("/tmp/kilo/pakistan-districts.geojson");
await card.locator("button").filter({ hasText: /Upload boundaries|Replace with a new file/ }).first().click();
await page.waitForTimeout(3000);
const uploaded = await card.innerText();
console.log("LAYER_UPLOADED:", /8 boundaries|pakistan-districts/.test(uploaded) ? "yes" : uploaded.replace(/\n/g, " | ").slice(0, 120));
await card.screenshot({ path: "/tmp/kilo/shots/demo30-settings-layer.png" });

// 2. The plan map now draws the uploaded layer.
await page.goto(`${BASE}/projects/${NUTRITION}/activities`, { waitUntil: "domcontentloaded", timeout: 90000 });
await page.locator('[role="group"][aria-label="View"]').locator("button", { hasText: "Map" }).first().click({ timeout: 60000 });
await page.locator("canvas").first().waitFor({ timeout: 60000 });
await page.waitForTimeout(4000);
console.log("PLAN_MAP_ON_CUSTOM_LAYER_DRAWN");
await page.screenshot({ path: "/tmp/kilo/shots/demo30-plan-map-custom.png" });

// 3. Pin a place by hand through the form.
await page.goto(`${BASE}/projects/${NUTRITION}/activities/plan/new`, { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForLoadState("networkidle", { timeout: 90000 }).catch(() => {});
await page.fill('input[maxlength="300"]', "Water trucking at the new camp site");
await page.locator('input[type="date"]').first().fill("2026-11-02");
const more = page.locator("details summary", { hasText: "More details" });
await more.click();
const placeBtn = page.locator("button", { hasText: "Place it on the map" }).first();
await placeBtn.waitFor({ timeout: 60000 });
await placeBtn.click();
await page.locator('[role="application"]').locator("div").first().waitFor({ timeout: 60000 });
await page.waitForTimeout(3500);
const pickerCanvas = page.locator('[role="application"] canvas');
await pickerCanvas.waitFor({ timeout: 60000 });
await page.waitForTimeout(3500);
await pickerCanvas.scrollIntoViewIfNeeded();
await page.waitForTimeout(500);
const pickerBox = await pickerCanvas.boundingBox();
if (pickerBox) {
  await page.mouse.click(pickerBox.x + pickerBox.width * 0.55, pickerBox.y + pickerBox.height * 0.5);
  await page.waitForTimeout(1200);
}
const pinText = await page.locator("p", { hasText: /^\s*-?\d+\.\d+(?:,|-?\d+\.\d+\s*)/ }).filter({ hasText: "," }).first().innerText().catch(() => "");
console.log("PIN_SET:", pinText.slice(0, 40) || "not captured");
await page.screenshot({ path: "/tmp/kilo/shots/demo30-pin-form.png" });
await page.locator('button[type="submit"]:not([disabled])').first().click();
await page.waitForURL(/activities\?view=planned/, { timeout: 60000 });
console.log("PINNED_ACTIVITY_SAVED");

// 4. The map shows the pinned site (red: future start, on time — wait for canvas).
await page.waitForTimeout(4000);
await page.locator('[role="group"][aria-label="View"]').locator("button", { hasText: "Map" }).first().click({ timeout: 60000 });
await page.locator("canvas").first().waitFor({ timeout: 60000 });
await page.waitForTimeout(4000);
console.log("MAP_WITH_PIN_DRAWN");
await page.screenshot({ path: "/tmp/kilo/shots/demo30-map-with-pin.png" });

console.log("READY: browser left open — explore");
await new Promise(() => {});
