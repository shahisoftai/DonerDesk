import { attach, BASE } from "./lib.mjs";
const { page, browser } = await attach();
await page.goto(`${BASE}/onboarding/team`); await page.waitForLoadState("networkidle");
console.log((await page.locator("main").innerText()).slice(0,1200));
await page.getByRole("button", { name: "Invite member" }).click(); await page.waitForTimeout(1000);
console.log(await page.getByLabel("Role").last().locator("option").allInnerTexts());
await browser.close(); process.exit(0);
