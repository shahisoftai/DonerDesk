import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("cmd2");
await page.goto(BASE + "/visuals/fee3d075-90d6-4c46-b028-09e0d812852a", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(8000);
await page.getByRole("button", { name: "Edit", exact: true }).click(); await page.waitForTimeout(3000);
const skip = page.getByRole("button", { name: "Skip" }); if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(800); }
await page.getByRole("button", { name: "Commands" }).click(); await page.waitForTimeout(1500);
console.log("COMMANDS:", (await page.locator("[role=dialog]").last().innerText().catch(()=>"?")).replace(/\n+/g," / ").slice(0,1000));
await page.keyboard.press("Escape"); await page.waitForTimeout(500);
await page.locator("button", { hasText: /^\?$/ }).first().click(); await page.waitForTimeout(1200);
console.log("SHORTCUTS:", (await page.locator("[role=dialog]").last().innerText().catch(()=>"?")).replace(/\n+/g," / ").slice(0,1000));
await browser.close(); process.exit(0);
