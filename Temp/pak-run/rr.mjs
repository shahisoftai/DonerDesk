import { attach } from "./lib.mjs";
const { page, shot, browser } = await attach("rr");
await page.goto("https://donordesk.online/projects/new/wizard?id=89a4d1e9-a837-470d-9f66-a30c21d640dc"); await page.waitForTimeout(3000);
await page.getByRole("button",{name:/^1\. /}).first().click(); await page.waitForTimeout(1500);
await page.getByRole("button",{name:"Read this part again"}).first().click(); await page.waitForTimeout(1000);
await page.getByRole("button",{name:"Read again",exact:true}).click().catch(()=>{});
await page.waitForTimeout(40000); await shot("rr");
await browser.close();
