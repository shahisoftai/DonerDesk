import { open, tabs, todo } from "./wz.mjs";
const { page, browser } = await open("wz22");
await page.getByRole("button", { name: /^5\. / }).click(); await page.waitForTimeout(2000);
const cb = page.locator("main input[type=checkbox]:visible"); const lbl = await cb.first().evaluate(e=>e.closest("label")?.innerText);
console.log("first area:", lbl);
await cb.first().check(); await page.waitForTimeout(3000);
console.log(await tabs(page)); console.log((await todo(page))?.slice(0,500));
const t = (await page.locator("main").innerText()).replace(/\n+/g," / "); const i=t.indexOf("Other places"); console.log(t.slice(i, i+500));
await browser.close(); process.exit(0);
