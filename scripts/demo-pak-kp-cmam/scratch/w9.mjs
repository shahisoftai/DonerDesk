import { attach } from "../lib.mjs";
const { page, shot, browser } = await attach("w9");
const t=await page.locator("main").innerText(); const i=t.indexOf("Start\n\nTell"); console.log(t.slice(i,i+900));
console.log(await page.locator("input[type=file]").count(), await page.getByRole("button").allInnerTexts().then(a=>a.filter(x=>/file|add|read|document|again/i.test(x))));
await shot("docs"); await browser.close();
