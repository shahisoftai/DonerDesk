import { attach, BASE } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const { page, browser } = await attach("ke-ws");
await page.goto(`${BASE}/projects/${P}/setup`); await page.waitForLoadState("networkidle");
await page.getByRole("button",{name:"Retry workspace"}).click(); 
for (let i=0;i<4;i++){ await page.waitForTimeout(5000); await page.reload(); await page.waitForLoadState("networkidle"); const t=await page.locator("main").innerText(); if(!/being provisioned|OAuth refresh failed|provisioning failed/.test(t)){console.log("provisioned after",(i+1)*5,"s");break;} if(i==11)console.log("still provisioning", t.match(/Workspace[^\n]*\n[^\n]*/g)); }
await browser.close(); process.exit(0);
