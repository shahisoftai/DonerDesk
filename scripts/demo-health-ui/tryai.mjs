import { attach, BASE } from "./lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const per = readFileSync("periods.txt","utf8").trim().split("\n"); const id = process.argv[2].length > 2 ? process.argv[2] : per[Number(process.argv[2])];
const { page, browser } = await attach();
await page.goto(`${BASE}/projects/${P}/reports/${id}`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(2500);
const btns = page.getByRole("button", { name: "Try AI again" }); const n = await btns.count(); console.log("fallback sections:", n);
for (let i = 0; i < n; i++) { await page.getByRole("button", { name: "Try AI again" }).first().click(); await page.waitForTimeout(30000); console.log("retried", i + 1, "remaining", await page.getByRole("button", { name: "Try AI again" }).count()); }
await browser.close(); process.exit(0);
