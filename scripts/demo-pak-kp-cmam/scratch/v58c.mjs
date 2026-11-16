import { attach } from "../lib.mjs";
const { page, shot, browser } = await attach("v58c");
for (let i = 0; i < 12; i++) { await page.waitForTimeout(10000); const d = await page.getByLabel("Better when", { exact: true }).evaluateAll(s => s.map(x => x.value)); const n = d.filter(x => x).length; console.log(i, "set:", n); if (n >= 40) break; }
const dirs = await page.getByLabel("Better when", { exact: true }).evaluateAll(s => s.map(x => x.value));
console.log("lower:", dirs.filter(d => d === "LOWER").length, "higher:", dirs.filter(d => d === "HIGHER").length, "none:", dirs.filter(d => !d).length);
console.log("button still:", await page.getByRole("button", { name: /Use suggested settings for all/ }).count());
await shot("v58c"); await browser.close();
