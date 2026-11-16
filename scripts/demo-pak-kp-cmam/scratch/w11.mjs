import { attach, BASE } from "../lib.mjs";
const { page, shot, browser } = await attach("w11");
const D=new URL("../inputs/", import.meta.url).pathname;
page.setDefaultTimeout(30000);
await page.getByText("Start a different project instead").click(); await page.waitForTimeout(3000);
console.log(page.url());
await page.waitForSelector("#pcw-file");
const sels=page.locator("main select"); console.log("main selects", await sels.count());
await sels.first().selectOption({ label: "Nutrition" });
await page.getByLabel("Donor",{exact:true}).fill("UNICEF"); await page.getByLabel("Donor",{exact:true}).press("Tab");
await page.getByLabel("Country",{exact:true}).fill("Pakistan"); await page.getByLabel("Country",{exact:true}).press("Tab");
await page.locator("#pcw-file").setInputFiles((process.argv[2]||"logframe.csv,indicators.csv,workplan.csv").split(",").map(f=>D+f));
const t0=Date.now();
await page.getByRole("button", { name: "Read my documents" }).click();
for (let i=0;i<80;i++){ await page.waitForTimeout(4000); const t=await page.locator("main").innerText(); if(/timed out|expired|could not be read|failed/i.test(t)){console.log("ERR",(Date.now()-t0)/1000,t.match(/.*(timed out|expired|could not be read|failed).*/i)[0]);break;} if(!/Sending|Reading|being read|in progress/i.test(t)&&i>1){console.log("done",(Date.now()-t0)/1000);break;} }
await shot("read-sheets"); const t=await page.locator("main").innerText(); console.log(t.slice(t.indexOf("Still to answer")));
await browser.close();
