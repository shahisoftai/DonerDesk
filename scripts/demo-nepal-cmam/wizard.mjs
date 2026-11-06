import { attach, BASE } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const { page, browser } = await attach("wizard");
await page.goto(`${BASE}/projects/${P}/activities/plan/start`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(1500);
await page.getByRole("button", { name: "Next" }).click(); await page.waitForTimeout(1000);
const boxes = page.getByRole("checkbox"); for (const i of [0, 1, 2, 4, 5, 6]) await boxes.nth(i).check();
const row = page.locator("li, div, fieldset").filter({ hasText: "A1.4 Train health workers" }).filter({ has: page.locator("input[type=date]") }).last();
await row.locator("input[type=date]").nth(0).fill("2026-01-12"); await row.locator("input[type=date]").nth(1).fill("2026-01-30");
await page.getByRole("button", { name: "Next" }).click(); await page.waitForTimeout(1200);
const who = ["Ram", "Ram", "Ram", "Anita", "Sunita", "Sunita", "Bikash"]; const sels = page.locator("select");
for (let i = 0; i < 7; i++) { const opts = await sels.nth(i).locator("option").allInnerTexts(); await sels.nth(i).selectOption({ label: opts.find(o => o.includes(who[i])) }); }
await page.getByRole("button", { name: "Finish" }).click(); await page.waitForTimeout(4000);
console.log((await page.locator("main").innerText()).replace(/\n+/g, " | ").match(/\d+ activities, \d+ repeating monthly\./)?.[0]);
await page.getByRole("button", { name: "Create" }).click(); await page.waitForTimeout(7000);
console.log(page.url().replace(BASE, ""));
await browser.close(); process.exit(0);
