import { attach } from "../lib.mjs";
const { page, shot, browser } = await attach("w5");
page.setDefaultTimeout(60000);
await page.getByRole("button", { name: "Read my documents" }).click();
for (let i=0;i<40;i++){ await page.waitForTimeout(8000); const t=await page.locator("main").innerText(); if(/timed out|expired|could not/i.test(t)){console.log("ERR",t.match(/.*(timed out|expired|could not).*/i)[0]);break;} if(!/Sending|Reading|being read|in progress/i.test(t)&&i>2) break; }
await shot("after-read"); console.log((await page.locator("main").innerText()).slice(0,1800));
await browser.close();
