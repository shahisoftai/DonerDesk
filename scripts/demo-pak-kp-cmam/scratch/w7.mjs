import { attach } from "../lib.mjs";
const { page, shot, browser } = await attach("w7");
page.setDefaultTimeout(60000);
for (let i=0;i<4;i++){ const b=page.getByRole("button",{name:"Remove"}).last(); if(await b.count()) await b.click(); }
console.log((await page.locator("main").innerText()).match(/\d of 5 files/)?.[0]);
const t0=Date.now();
await page.getByRole("button", { name: "Read my documents" }).click();
for (let i=0;i<60;i++){ await page.waitForTimeout(4000); const t=await page.locator("main").innerText(); if(/timed out|expired|could not|failed/i.test(t)){console.log("ERR",(Date.now()-t0)/1000,t.match(/.*(timed out|expired|could not|failed).*/i)[0]);break;} if(!/Sending|Reading|being read|in progress/i.test(t)&&i>1){console.log("done",(Date.now()-t0)/1000);break;} }
await shot("read1"); console.log((await page.locator("main").innerText()).slice(1300,2600));
await browser.close();
