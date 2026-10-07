import { attach, BASE } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const per = readFileSync("periods.txt","utf8").trim().split("\n"); const { page, browser } = await attach("flags");
await page.goto(`${BASE}/projects/${P}/reports/${per[Number(process.argv[2])]}`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(2000);
await page.getByText(/flagged statement/).first().click(); await page.waitForTimeout(2500);
console.log((await page.locator("body").innerText()).split("Statements")[1]?.slice(0,2500));
await browser.close(); process.exit(0);
