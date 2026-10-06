import { attach, BASE, dump } from "./lib.mjs";
const { page, browser } = await attach();
await page.goto(`${BASE}/onboarding/team`); await page.waitForLoadState("networkidle");
await page.getByRole("button", { name: "Invite member" }).click(); await page.waitForTimeout(800);
console.log((await dump(page)).filter(l=>/select|input/.test(l)).join("\n"));
await browser.close(); process.exit(0);
