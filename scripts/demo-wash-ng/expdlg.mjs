import { attach, BASE, dump } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const per = readFileSync("periods.txt","utf8").trim().split("\n"); const { page, browser } = await attach("expdlg");
await page.goto(`${BASE}/projects/${P}/reports/${per[Number(process.argv[2])]}`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(2000);
await page.getByRole("button", { name: "Export report" }).first().click(); await page.waitForTimeout(3000);
const d = page.locator("[role=dialog]").first();
console.log((await d.innerText()).replace(/\n+/g," | ").slice(0,2000)); console.log((await dump(page)).filter(l=>/select|checkbox|radio|button/.test(l)&&!/^a /.test(l)).slice(-14).join("\n"));
await page.screenshot({path:"shot-export.png"});
await browser.close(); process.exit(0);
