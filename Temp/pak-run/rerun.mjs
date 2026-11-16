import { attach } from "./lib.mjs";
const { page, shot, browser } = await attach("rerun");
await page.getByRole("button",{name:/^1\. /}).first().click(); await page.waitForTimeout(1500);
await page.getByRole("button",{name:"Read this part again"}).first().click();
for (let i=0;i<30;i++){ await page.waitForTimeout(5000); const t=await page.locator("main").innerText(); if(!/Reading|being read|Sending/i.test(t)) break; }
await page.getByRole("button",{name:/^2\. /}).first().click(); await page.waitForTimeout(2000);
const v = await page.locator("section[aria-roledescription='slide'] input, section[aria-roledescription='slide'] textarea").evaluateAll(els=>els.slice(0,6).map(e=>(e.labels?.[0]?.innerText||e.id)+"="+e.value));
console.log(v.join("\n")); await shot("facts-rerun");
await browser.close();
