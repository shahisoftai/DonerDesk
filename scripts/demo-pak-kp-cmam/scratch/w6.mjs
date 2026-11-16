import { attach } from "../lib.mjs";
const { page, shot, browser } = await attach("w6");
const D=new URL("../inputs/", import.meta.url).pathname;
page.setDefaultTimeout(60000);
await page.locator("#pcw-file").setInputFiles([D+"PAK-KP-Proposal.docx"]);
await page.waitForTimeout(800);
const t0=Date.now();
await page.getByRole("button", { name: "Read my documents" }).click();
for (let i=0;i<60;i++){ await page.waitForTimeout(5000); const t=await page.locator("main").innerText(); if(/timed out|expired|could not|failed/i.test(t)){console.log("ERR",(Date.now()-t0)/1000,t.match(/.*(timed out|expired|could not|failed).*/i)[0]);break;} if(!/Sending|Reading|being read|in progress/i.test(t)&&i>1){console.log("done",(Date.now()-t0)/1000);break;} }
await shot("read1"); console.log((await page.locator("main").innerText()).slice(0,1200));
await browser.close();
