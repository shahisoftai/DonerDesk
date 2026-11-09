import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("due2");
const d = page.getByLabel("Due (days after the period ends)"); console.log(await d.evaluateAll(a=>a.map(x=>x.value)));
await d.nth(1).fill("30"); await d.nth(1).blur(); await page.waitForTimeout(800); await d.nth(2).fill("30"); await d.nth(2).blur(); await page.waitForTimeout(1500);
console.log(await d.evaluateAll(a=>a.map(x=>x.value)));
const lay = page.getByLabel("Layout"); for (let i=0;i<await lay.count();i++){ await lay.nth(i).selectOption({label:"The standard layout"}); await page.waitForTimeout(500);} 
console.log((await page.locator("body").innerText()).match(/\d to answer|Complete/g)); 
console.log((await page.locator("main").innerText()).match(/The reporting calendar[\s\S]{0,700}/)?.[0]);
await browser.close(); process.exit(0);
