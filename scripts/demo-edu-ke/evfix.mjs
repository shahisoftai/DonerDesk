import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("evfix"); page.setDefaultTimeout(15000);
for (const u of ["", "?page=2"]) {
  await page.goto(BASE + "/projects/8e20556a-115e-48a7-be9b-bb1bfe14bf70/evidence" + u, { waitUntil: "domcontentloaded" }); await page.waitForTimeout(3500);
  const r = page.locator("main table tbody tr").filter({ hasText: "2026-03-OP2-1a" }).first(); if (!(await r.count())) continue;
  await r.getByRole("button", { name: /Remove link to Teacher coaching visits - March/ }).click(); await page.waitForTimeout(2500);
  const s = r.locator("select[aria-label='Link this file to an activity or indicator']"); const o = (await s.locator("option").allTextContents()).find((x) => x.startsWith("Teacher training on the competency-based curriculum - March"));
  await s.selectOption({ label: o }); await page.waitForTimeout(2500); console.log("fixed", o); break;
}
await browser.close(); process.exit(0);
