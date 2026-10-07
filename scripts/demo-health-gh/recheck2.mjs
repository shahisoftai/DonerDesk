import { attach, BASE } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const per = readFileSync("periods.txt","utf8").trim().split("\n"); const id = per[Number(process.argv[2])]; const { page, browser } = await attach("recheck2");
await page.goto(`${BASE}/projects/${P}/reports/${id}`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(2500);
await page.getByRole("button", { name: /Report checks/ }).click(); await page.waitForTimeout(1500);
const b = page.getByRole("button", { name: /Re-check affected sections/ }); console.log("recheck btn", await b.count()); if (await b.count()) { await b.first().click(); await page.waitForTimeout(25000); }
console.log((await page.locator("body").innerText()).split("Report checks").slice(-1)[0].replace(/\n+/g," | ").slice(0,700));
await browser.close(); process.exit(0);
