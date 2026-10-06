import { attach, BASE } from "./lib.mjs";
const { page, browser } = await attach();
await page.goto(`${BASE}/onboarding/team`); await page.waitForLoadState("networkidle");
await page.getByRole("button", { name: "Invite member" }).click(); await page.waitForTimeout(800);
await page.getByLabel("Email").fill("david.lokwang.demo@example.org");
await page.locator("form", { has: page.getByLabel("Email") }).getByLabel("Role").selectOption({ label: "M&E Officer" });
await page.getByRole("button", { name: "Send invite" }).click(); await page.waitForTimeout(3500);
const t = await page.locator("main").innerText(); console.log(t.match(/\/invite\/accept\?token=[0-9a-f-]+/)?.[0]);
await browser.close(); process.exit(0);
