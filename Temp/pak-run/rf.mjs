import { attach } from "./lib.mjs";
const { page, browser } = await attach("rf");
await page.getByRole("button",{name:/^1\. /}).first().click(); await page.waitForTimeout(1000);
await page.getByRole("button",{name:"Read this part again"}).first().click(); await page.waitForTimeout(800);
await page.getByRole("button",{name:"Read again",exact:true}).click().catch(()=>{});
for (let i=0;i<30;i++){ await page.waitForTimeout(5000); const t=await page.locator("main").innerText(); if(!/being read/.test(t)) break; }
await browser.close();
