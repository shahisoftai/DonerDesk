import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("flg6"); page.setDefaultTimeout(12000);
for (const t of ["Achievement of Objectives","Outcomes and Impact"]) {
  await page.getByText(t, { exact: true }).first().click().catch(()=>{}); await page.waitForTimeout(2500);
  for (let k = 0; k < 8; k++) {
    const b = page.getByRole("button", { name: "This matches a verified indicator" }); const c = await b.count(); if (!c) break;
    await b.first().click(); await page.waitForTimeout(4500);
    const body = await page.locator("body").innerText(); console.log(t, k, c, body.match(/\d+ of \d+ statements need your decision/)?.[0], (body.match(/Could not[^\n]*|failed[^\n]*|Something went wrong[^\n]*/i)||[""])[0]);
  }
}
await browser.close(); process.exit(0);
