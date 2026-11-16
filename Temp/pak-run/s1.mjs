import { attach } from "./lib.mjs";
const { page, shot, browser } = await attach("s1");
await page.getByRole("button",{name:/^1\. /}).first().click(); await page.waitForTimeout(1500);
const inputs = await page.locator("section[aria-roledescription='slide'] input, section[aria-roledescription='slide'] select").evaluateAll(els=>els.map(e=>({tag:e.tagName,id:e.id,name:e.name,type:e.type,label:e.labels?.[0]?.innerText,val:e.value})));
console.log(JSON.stringify(inputs,null,0));
await browser.close();
