import { open, tabs, shot } from "./wz.mjs";
const { page, browser } = await open("wz4");
await page.getByRole("button", { name: /^2\. / }).click(); await page.waitForTimeout(1500);
const f = page.locator("main input:visible, main textarea:visible");
await f.nth(0).fill("ZZ TEST how-to wizard check"); await f.nth(1).fill("ZZTEST-HOWTO");
await f.nth(2).fill("2026-12-01"); await f.nth(3).fill("2027-05-31"); await f.nth(4).fill("USD"); await f.nth(5).fill("Test project made to verify the support guide. Safe to archive.");
await page.waitForTimeout(1200);
for (const [name, email, role] of [["ZZ Test Manager", "zz-manager@example.invalid", "Project manager"], ["ZZ Test MEL", "zz-mel@example.invalid", "Monitoring and evaluation officer"]]) {
  await f.nth(6).fill(name); await f.nth(7).fill(email);
  await page.locator("main select:visible").nth(0).selectOption({ label: role });
  await page.getByRole("button", { name: "Add to team" }).click(); await page.waitForTimeout(1800);
}
await page.getByLabel(/There are no outside partners/).check().catch(async()=>{ await page.getByText("There are no outside partners").click(); });
await page.waitForTimeout(2500);
console.log(await tabs(page));
console.log((await page.locator("main").innerText()).replace(/\n+/g," / ").split("Team /")[1]?.slice(0,900));
await shot(page, "wz4");
await browser.close(); process.exit(0);
