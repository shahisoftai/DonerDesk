import { attach } from "../lib.mjs";
const { page, shot, browser } = await attach("w8");
const D=new URL("../inputs/", import.meta.url).pathname;
page.setDefaultTimeout(60000);
for (const f of process.argv.slice(2)) {
  console.log("adding", f);
  await page.locator("#pcw-file").setInputFiles([D+f]);
  await page.waitForTimeout(800);
  const t0=Date.now();
  await page.getByRole("button", { name: "Read my documents" }).click();
  for (let i=0;i<80;i++){ await page.waitForTimeout(4000); const t=await page.locator("main").innerText(); if(/timed out|expired|could not be read|failed/i.test(t)){console.log("ERR",(Date.now()-t0)/1000,t.match(/.*(timed out|expired|could not be read|failed).*/i)[0]);break;} if(!/Sending|Reading|being read|in progress/i.test(t)&&i>1){console.log("done",(Date.now()-t0)/1000);break;} }
  await shot("read-"+f.replace(/\W/g,""));
}
const t=await page.locator("main").innerText(); const i=t.indexOf("Your documents"); console.log(t.slice(i,i+1500)); console.log(t.slice(t.indexOf("Still to answer")));
await browser.close();
