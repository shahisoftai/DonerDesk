import { attach } from "./lib.mjs";
const { page, shot, browser } = await attach("look");
const n=process.argv[2];
await page.getByRole("button",{name:new RegExp("^"+n+"\\. ")}).first().click().catch(async()=>{await page.getByText(new RegExp("^"+n+"\\. ")).first().click();});
await page.waitForTimeout(2500); await shot("slide"+n);
const t=await page.locator("section[aria-roledescription='slide']").innerText().catch(()=>page.locator("main").innerText());
console.log(t.slice(0,2200));
await browser.close();
