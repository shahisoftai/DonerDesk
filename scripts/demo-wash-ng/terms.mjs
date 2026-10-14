import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("terms");
await page.goto(BASE + "/onboarding"); await page.waitForLoadState("networkidle"); await page.waitForTimeout(1200);
const c = page.getByRole("checkbox"); if (await c.count()) await c.first().check();
await page.getByRole("button", { name: "Accept and finish setup" }).click(); await page.waitForTimeout(4000); console.log(page.url());
await browser.close(); process.exit(0);
