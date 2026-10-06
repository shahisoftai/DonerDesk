import { attach, BASE } from "./lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const per = readFileSync("periods.txt","utf8").trim().split("\n"); const id = process.argv[2].length > 2 ? process.argv[2] : per[Number(process.argv[2])];
const { page, browser } = await attach();
await page.goto(`${BASE}/projects/${P}/reports/${id}`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(2500);
await page.getByRole("button", { name: /Report checks/ }).first().click(); await page.waitForTimeout(1500);
const b = page.getByRole("button", { name: "Regenerate summary" }); if (await b.count()) { await b.first().click(); await page.waitForTimeout(40000); console.log("summary regenerated"); } else console.log("no stale summary");
await browser.close(); process.exit(0);
