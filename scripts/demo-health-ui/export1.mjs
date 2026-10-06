import { attach, BASE, dump } from "./lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const per = readFileSync("periods.txt","utf8").trim().split("\n"); const id = process.argv[2].length > 2 ? process.argv[2] : per[Number(process.argv[2])];
const { page, browser } = await attach();
await page.goto(`${BASE}/projects/${P}/reports/${id}`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(2500);
await page.getByRole("button", { name: "Export report" }).first().click(); await page.waitForTimeout(6000);
console.log(page.url()); const t = await page.locator("main").innerText().catch(()=>page.locator("body").innerText()); console.log(t.slice(t.indexOf("Export")).slice(0, 3500));
console.log((await dump(page)).filter(l=>/button|radio|checkbox/.test(l) && !/^a /.test(l) && !/Approved/.test(l)).join("\n"));
await page.screenshot({path:"export1.png"});
await browser.close(); process.exit(0);
