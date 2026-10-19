import { attach, BASE } from "../demo-ui/lib.mjs"; import { asUser } from "./asuser.mjs"; import { PEOPLE } from "./data.mjs";
const { browser } = await attach("terms");
for (const p of PEOPLE) {
  const { ctx, page } = await asUser(browser, p.email);
  await page.goto(BASE + "/onboarding#legal-consent"); await page.waitForLoadState("networkidle"); await page.waitForTimeout(1500);
  const box = page.getByRole("checkbox").first(); await box.waitFor({ timeout: 15000 }).catch(() => {});
  if (await box.count()) { await box.check(); await page.getByRole("button", { name: "Accept and finish setup" }).click(); await page.waitForTimeout(3500); }
  await page.goto(BASE + "/my-work"); await page.waitForLoadState("networkidle"); await page.waitForTimeout(1500);
  console.log(p.name, page.url().replace(BASE, ""), (await page.locator("main").innerText()).replace(/\n+/g, " | ").slice(0, 120));
  await ctx.close();
}
await browser.close(); process.exit(0);
