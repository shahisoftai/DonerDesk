import { attach, BASE, dump } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const per = readFileSync("periods.txt","utf8").trim().split("\n"); const id = per[Number(process.argv[2])]; const { page, browser } = await attach("exp");
await page.goto(`${BASE}/projects/${P}/reports/${id}`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(2500);
await page.getByRole("button", { name: "Export report" }).first().click(); await page.waitForTimeout(5000);
console.log(page.url()); console.log((await page.locator("body").innerText()).split("Export center")[1]?.replace(/\n+/g," | ").slice(0,1500));
console.log((await dump(page)).filter(l=>/button|radio|checkbox|select/.test(l) && !/^a /.test(l) && !/Approved/.test(l)).slice(-20).join("\n"));
await browser.close(); process.exit(0);
