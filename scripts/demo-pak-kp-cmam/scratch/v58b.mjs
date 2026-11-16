import { attach, BASE } from "../lib.mjs";
const { page, shot, browser } = await attach("v58b");
page.setDefaultTimeout(40000);
const D = new URL("../inputs/", import.meta.url).pathname;
await page.goto(`${BASE}/projects/new/wizard`); await page.waitForSelector("h1"); await page.waitForTimeout(2500);
await page.getByText("Start a different project instead").click().catch(() => {}); await page.waitForTimeout(2500);
await page.waitForSelector("#pcw-file");
await page.locator("main select").first().selectOption({ label: "Nutrition" });
await page.locator("#pcw-file").setInputFiles([D + "indicators.csv"]);
await page.getByRole("button", { name: "Read my documents" }).click();
for (let i = 0; i < 60; i++) { await page.waitForTimeout(4000); const t = await page.locator("main").innerText(); if (/timed out|expired/i.test(t)) { console.log("READ FAIL"); break; } if (!/Sending|Reading|being read|in progress/i.test(t) && i > 1) break; }
await page.getByRole("button", { name: /^4\. / }).first().click(); await page.waitForTimeout(1500);
const c = page.getByRole("button", { name: /^Confirm all \d+/ }).first(); if (await c.count()) { await c.click(); await page.waitForTimeout(6000); }
const before = await page.getByLabel("Kind of number", { exact: true }).evaluateAll(s => s.filter(x => x.value === "").length);
const btn = page.getByRole("button", { name: /Use suggested settings for all/ });
console.log("button:", await btn.count(), await btn.first().innerText().catch(() => "-"), "| cards with empty kind before:", before);
await btn.first().click(); await page.waitForTimeout(12000);
const after = await page.getByLabel("Kind of number", { exact: true }).evaluateAll(s => s.filter(x => x.value === "").length);
const dirs = await page.getByLabel("Better when", { exact: true }).evaluateAll(s => s.map(x => x.value));
console.log("empty kind after:", after, "| lower:", dirs.filter(d => d === "LOWER").length, "higher:", dirs.filter(d => d === "HIGHER").length, "none:", dirs.filter(d => !d).length);
await shot("v58b"); await browser.close();
