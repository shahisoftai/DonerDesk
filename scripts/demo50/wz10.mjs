import { open, tabs, todo, shot } from "./wz.mjs";
const { page, browser } = await open("wz10");
await page.getByRole("button", { name: /^4\. / }).click(); await page.waitForTimeout(2500);
const n = await page.getByLabel("Target", { exact: true }).count(); console.log("cards:", n);
for (let i = 0; i < n; i++) {
  await page.getByLabel("Starting value", { exact: true }).nth(i).fill("0");
  await page.getByLabel("Target", { exact: true }).nth(i).fill("100");
  const resp = page.getByLabel("Responsible", { exact: true }).nth(i); const ro = await resp.locator("option").allInnerTexts();
  if (i === 0) console.log("responsible options:", ro);
  await resp.selectOption({ index: 1 });
  const bw = page.getByLabel("Better when", { exact: true }).nth(i); if (i === 0) console.log("better when:", await bw.locator("option").allInnerTexts());
  await bw.selectOption({ index: 1 });
  await page.waitForTimeout(400);
}
await page.waitForTimeout(2500);
console.log(await tabs(page)); console.log(await todo(page));
await shot(page, "wz10");
await browser.close(); process.exit(0);
