import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("o");
const s = page.locator("main select"); const n = await s.count();
for (let i = n-9; i < n; i++) console.log(i, (await s.nth(i).evaluate(e=>[...e.options].map(o=>o.textContent.trim()).slice(0,6))).join(" | ").slice(0,300));
console.log((await page.locator("main").innerText()).match(/charts? can be drawn[^\n]*/)?.[0]);
await browser.close(); process.exit(0);
