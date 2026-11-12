import { open, tabs, todo } from "./wz.mjs";
const { page, browser } = await open("wz26");
await page.getByRole("button", { name: /^6\. / }).click(); await page.waitForTimeout(2500);
for (let idx = 2; idx <= 12; idx++) {
  await page.getByLabel("Activity", { exact: true }).last().fill("ZZ Test activity " + idx);
  const sel = page.getByLabel("Part of", { exact: true }).last(); const opts = await sel.locator("option").count();
  await sel.selectOption({ index: Math.min(idx, opts - 1) });
  await page.getByRole("button", { name: "Add an activity" }).click(); await page.waitForTimeout(1500);
}
const acc = page.getByRole("button", { name: /Accept all/ }); if (await acc.count()) await acc.click();
await page.waitForTimeout(2000);
const boxes = page.locator("main input[type=checkbox]:visible"); const n = await boxes.count(); let ticked = 0;
for (let i = 0; i < n; i++) { const l = await boxes.nth(i).evaluate(e => (e.closest("label")?.innerText||"").trim()); if (/^(WASH-|IND1)/.test(l) && !(await boxes.nth(i).isChecked())) { await boxes.nth(i).check().catch(()=>{}); ticked++; } }
await page.waitForTimeout(3000); console.log("ticked", ticked);
console.log(await tabs(page)); console.log((await todo(page))?.slice(0,600));
await browser.close(); process.exit(0);
