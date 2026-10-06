import { attach, BASE } from "./lib.mjs";
const { page, browser } = await attach();
await page.goto(`${BASE}/onboarding/team`); await page.waitForLoadState("networkidle");
console.log((await page.locator("main").innerText()).split("Name\tEmail")[1]);
await browser.close(); process.exit(0);
