import { open, tabs, todo } from "./wz.mjs";
const { page, browser } = await open("wz25");
await page.getByRole("button", { name: /^6\. / }).click(); await page.waitForTimeout(2500);
const acc = page.getByRole("button", { name: /Accept all/ }); if (await acc.count()) { await acc.click(); await page.waitForTimeout(2000); }
await page.getByLabel("Starts", { exact: true }).first().fill("2026-12-01");
await page.getByLabel("Ends", { exact: true }).first().fill("2027-04-30");
await page.getByLabel("Led by", { exact: true }).first().selectOption({ index: 1 });
await page.waitForTimeout(800);
const where = page.locator("input[type=checkbox]").filter({ has: page.locator("xpath=.") });
const boxes = page.locator("main input[type=checkbox]:visible"); const n = await boxes.count(); const labels=[];
for (let i = 0; i < n; i++) labels.push(await boxes.nth(i).evaluate(e => (e.closest("label")?.innerText||"").trim().slice(0,40)));
for (let i=0;i<n;i++) { if (/^(Project-wide|WASH-|IND1)/.test(labels[i]) ) { if (/^Project-wide/.test(labels[i]) || /^(WASH-|IND1)/.test(labels[i])) await boxes.nth(i).check().catch(()=>{}); } }
await page.waitForTimeout(2500);
console.log(await tabs(page)); console.log((await todo(page))?.slice(0,600));
await browser.close(); process.exit(0);
