import { attach, BASE } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const per = readFileSync("periods.txt","utf8").trim().split("\n"); const { page, browser } = await attach("chk2");
await page.goto(`${BASE}/projects/${P}/reports/${per[5]}`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(2500);
await page.getByRole("button", { name: /Finish \d+ remaining check/ }).click(); await page.waitForTimeout(2000);
await page.screenshot({ path: "shot-checks5.png" });
await browser.close(); process.exit(0);
