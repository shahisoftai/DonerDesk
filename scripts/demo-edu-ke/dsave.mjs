import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("dsave"); page.setDefaultTimeout(15000);
await page.getByRole("button", { name: "Save", exact: true }).first().click(); await page.waitForTimeout(4000);
await page.getByRole("button", { name: /^Done editing/ }).click().catch(()=>{}); await page.waitForTimeout(5000);
const t = await page.locator("main").innerText();
console.log(t.slice(0,300)); console.log(t.match(/[^\n]*(Choose a project|Not yet reported|unavailable|Not available)[^\n]*/g));
await browser.close(); process.exit(0);
