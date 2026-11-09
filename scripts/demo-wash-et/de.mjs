import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("de");
const sels = page.locator("main select").filter({ hasText: "Typed in" });
let c = await sels.count(); console.log("selects", c);
for (let i = 0; i < c; i++) { const s = sels.nth(i); const v = await s.evaluate(e=>e.selectedOptions[0]?.text); if (/choose/.test(v)) { await s.selectOption({ label: "Typed in" }); await page.waitForTimeout(900); } }
await page.waitForTimeout(1500);
console.log((await page.locator("main").innerText()).match(/Still to answer \(\d+\)[\s\S]{0,300}/)?.[0]);
console.log((await page.locator("body").innerText()).match(/\d to answer|Complete/g)?.length);
await browser.close(); process.exit(0);
