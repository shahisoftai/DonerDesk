import { attach, BASE } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const { page, browser } = await attach("ke-drill");
await page.goto(`${BASE}/projects/${P}/maps`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(6000);
await page.mouse.click(712,505); await page.waitForTimeout(1500);
console.log(await page.getByRole("button").allInnerTexts().then(a=>a.filter(x=>/drill|open|look|Kenya|Counties|Districts|Sub/i.test(x))));
const d = page.getByRole("button",{name:/Drill|Look inside|Open/i}).first(); if (await d.count()) { await d.click(); await page.waitForTimeout(3500); }
console.log(await page.getByRole("button").allInnerTexts().then(a=>a.filter(x=>/Counties|Districts|Sub|Kenya|World|Provinces/i.test(x))));
const u=await page.locator("main").innerText(); console.log(u.match(/\d+ of \d+ places have a figure\./)?.[0]);
await page.screenshot({path:"drill.png", clip:{x:200,y:330,width:1200,height:620}});
await browser.close(); process.exit(0);
