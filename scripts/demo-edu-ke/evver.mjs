import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("evver"); page.setDefaultTimeout(15000);
await page.goto('https://donordesk.online/projects/8e20556a-115e-48a7-be9b-bb1bfe14bf70/evidence?page=2', { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(4000);
for (let k = 0; k < 1; k++) {
  const cbs = page.locator("main input[type=checkbox][aria-label^='Select ']"); const n = await cbs.count(); if (!n) break;
  for (let i = 0; i < n; i++) await cbs.nth(i).check().catch(()=>{});
  await page.waitForTimeout(800);
  const v = page.locator("button").filter({ hasText: /Verify.*selected/ }).first(); console.log("enabled", await v.isEnabled());
  await v.click(); await page.waitForTimeout(12000);
  await page.reload({ waitUntil: "domcontentloaded" }); await page.waitForTimeout(4000);
  console.log("round", k, (await page.locator("main").innerText()).match(/Select all \d+ awaiting[^\n]*/g));
}
await browser.close(); process.exit(0);
