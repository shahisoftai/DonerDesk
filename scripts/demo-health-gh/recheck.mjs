import { attach, BASE, dump } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const per = readFileSync("periods.txt","utf8").trim().split("\n"); const id = per[Number(process.argv[2])]; const { page, browser } = await attach("recheck");
await page.goto(`${BASE}/projects/${P}/reports/${id}`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(2500);
await page.getByRole("button", { name: "More actions" }).first().click().catch(async()=>{ await page.locator("header button").last().click(); }); await page.waitForTimeout(1000);
console.log((await dump(page)).filter(l=>/button|menuitem/.test(l)&&!/^a /.test(l)).slice(-25).join("\n"));
await browser.close(); process.exit(0);
