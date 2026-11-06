import { attach, BASE } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const per = readFileSync("periods.txt","utf8").trim().split("\n"); const id = per[Number(process.argv[2])]; const { page, browser } = await attach("pref");
await page.goto(`${BASE}/projects/${P}/reports/${id}/export`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(2500);
const t = (await page.locator("main").innerText()).replace(/\n+/g," | "); const s = t.split("Preflight summary")[1] ?? ""; console.log("PREFLIGHT:", s.split("| Exports")[0].slice(0,700));
await browser.close(); process.exit(0);
