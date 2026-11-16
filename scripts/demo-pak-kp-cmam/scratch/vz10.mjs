import { attach, BASE } from "../lib.mjs";
const { page, browser } = await attach("vz10");
await page.goto(`${BASE}/visuals`); await page.waitForTimeout(5000);
const t = await page.locator("main").innerText();
const lines = t.split("\n"); console.log(lines.length, lines.filter(l => /DEMO-17|screening and treatment|^Nutrition/.test(l)));
console.log(await page.getByRole("button").allInnerTexts().then(a => a.filter(x => /more|next|show/i.test(x))));
await browser.close();
