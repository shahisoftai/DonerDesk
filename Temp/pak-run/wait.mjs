import { attach } from "./lib.mjs";
const { page, shot, browser } = await attach("wait");
for (let i=0;i<60;i++){ const t=await page.locator("main").innerText(); const busy=/Sending…|Reading|being read|in progress/i.test(t); if(!busy){break;} await page.waitForTimeout(10000); }
await shot("after-read");
const t=await page.locator("main").innerText();
console.log(page.url()); console.log(t.slice(0,1800));
for (const l of ["Donor","Country"]) console.log(l, await page.getByLabel(l,{exact:true}).first().inputValue().catch(e=>"?"));
await browser.close();
