import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("share3");
await page.goto(BASE + "/visuals/fee3d075-90d6-4c46-b028-09e0d812852a", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(8000);
await page.locator("summary", { hasText: /^Share and publish/ }).first().click(); await page.waitForTimeout(1000);
page.on("dialog", d => d.accept());
await page.locator("details[open]").last().getByRole("button", { name: "Withdraw" }).click(); await page.waitForTimeout(3000);
console.log((await page.locator("details[open]").last().innerText()).replace(/\n+/g," / ").match(/Share links[^]{0,100}|Withdrawn[^/]*|Live ·[^/]*/g));
await browser.close(); process.exit(0);
