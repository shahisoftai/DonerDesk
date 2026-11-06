// Headless probe: does the picker's click handler fire, and does convertFromPixel return coordinates?
import { chromium } from "@playwright/test";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
const logs = [];
page.on("console", (m) => logs.push(`${m.type()}: ${m.text().slice(0, 160)}`));
page.on("pageerror", (e) => logs.push(`PAGEERROR: ${e.message.slice(0, 200)}`));
page.on("response", (r) => { if (r.status() >= 400) logs.push(`HTTP ${r.status()}: ${r.url().slice(0, 120)}`); });

await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
await page.fill("#email", "mnpiracha@gmail.com");
await page.fill("#password", "Shahikhail@@0011");
await page.click('button[type="submit"]');
await page.waitForURL(/dashboard|projects|onboarding/, { timeout: 60000 });

await page.goto("http://localhost:3000/projects/1f02b38c-a60c-410d-8497-669c85e2fde4/activities/plan/new", { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForLoadState("networkidle", { timeout: 90000 }).catch(() => {});
const more = page.locator("details summary", { hasText: "More details" });
await more.click();
const placeBtn = page.locator("button", { hasText: "Place it on the map" }).first();
await placeBtn.waitFor({ timeout: 60000 });
await placeBtn.click();
const app = page.locator('[role="application"]');
await app.waitFor({ timeout: 60000 });
await page.waitForTimeout(15000);
const canvas = app.locator("canvas");
console.log("CANVAS:", await canvas.count());
const box = await canvas.boundingBox();
console.log("BOX:", JSON.stringify(box));
if (box) {
  await canvas.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  const box2 = await canvas.boundingBox();
  const cx = (box2 ?? box).x + (box2 ?? box).width * 0.5;
  const cy = (box2 ?? box).y + (box2 ?? box).height * 0.5;
  const top = await page.evaluate(([x, y]) => {
    const el = document.elementFromPoint(x, y);
    return el ? `${el.tagName}.${String(el.className).slice(0, 70)}` : "none";
  }, [cx, cy]);
  console.log("TOP_ELEMENT:", top);
  await page.mouse.click(cx, cy);
  await page.waitForTimeout(1000);
  const pin = await page.locator("text=/^-?\\d+\\.\\d+, -?\\d+\\.\\d+$/").count();
  console.log("PIN_TEXT_AFTER_CLICK:", pin);
  // Try a drag-free second click at another spot
  await page.mouse.click(box.x + box.width * 0.4, box.y + box.height * 0.4);
  await page.waitForTimeout(1000);
  console.log("PIN_TEXT_AFTER_2ND:", await page.locator("text=/^-?\\d+\\.\\d+, -?\\d+\\.\\d+$/").count());
}
console.log("CONSOLE:", logs.filter((l) => l.includes("PICKER") || l.includes("PAGEERROR")).slice(0, 12).join(" ;; "));
await browser.close();
// after clicks: what is on top at the canvas center?
