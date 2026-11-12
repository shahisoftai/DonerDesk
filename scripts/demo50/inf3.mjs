import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("inf3");
await page.goto(BASE + "/visuals/f4184abd-b672-46ad-9063-4b3180606a48", { waldUntil: "domcontentloaded" }).catch(()=>{}); await page.waitForTimeout(9000);
await page.locator("summary", { hasText: /^Design check/ }).first().click(); await page.waitForTimeout(1200);
console.log("CHECK:", (await page.locator("details[open]").last().innerText()).replace(/\n+/g," / ").slice(0,900));
await browser.close(); process.exit(0);
