import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("done1"); page.setDefaultTimeout(10000);
await page.getByRole("button", { name: "Close", exact: true }).first().click().catch(()=>{}); await page.waitForTimeout(1000);
for (let i = 0; i < 15; i++) {
  const b = page.locator("main [role=group][aria-label=Status] button[aria-pressed=false]", { hasText: "Done" }).first();
  if (!(await b.count())) { console.log("no more"); break; }
  await b.click(); await page.waitForTimeout(2500);
  const dlg = page.getByRole("button", { name: /^(Confirm|Mark done|Yes|Save)/ }); if (await dlg.count()) { console.log("dialog", await dlg.first().innerText()); await dlg.first().click(); await page.waitForTimeout(2000); }
  console.log(i, "ok");
}
console.log((await page.locator("main").innerText()).match(/Completed[^\n]*|Late[^\n]*/g)?.slice(0,4));
await browser.close(); process.exit(0);
