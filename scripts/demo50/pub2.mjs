import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("pub2");
await page.goto(BASE + "/visuals/fee3d075-90d6-4c46-b028-09e0d812852a", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(8000);
await page.locator("summary", { hasText: /^Share and publish/ }).first().click(); await page.waitForTimeout(1000);
const d = page.locator("details[open]").last();
await d.getByRole("button", { name: "Approve", exact: true }).click(); await page.waitForTimeout(3500);
console.log("AFTER APPROVE:", (await d.innerText()).replace(/\n+/g," / ").slice(0,450));
console.log("alerts:", (await page.locator("[role=alert],[role=status]").allInnerTexts()).join("|").slice(0,300));
await browser.close(); process.exit(0);
