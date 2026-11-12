import { open, tabs, todo, shot } from "./wz.mjs";
const { page, browser } = await open("wz11");
await page.getByRole("button", { name: /^4\. / }).click(); await page.waitForTimeout(2500);
const card = page.locator("div", { has: page.locator("text=WASH-Q-01") }).last();
console.log((await card.innerText()).replace(/\n+/g," / ").slice(0,500));
console.log(await card.locator("input, select").evaluateAll(s=>s.map(x=>[x.tagName,x.type,(x.closest("label,div")?.innerText||"").slice(0,25).replace(/\n/g," "),x.value])));
await browser.close(); process.exit(0);
