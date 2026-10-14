import { attach, BASE, dump } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const { page, browser } = await attach("sitform");
await page.goto(`${BASE}/projects/${P}/reports/new`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(1200);
await page.getByLabel("Report type").selectOption({ label: "Situation report" }); await page.waitForTimeout(1200);
console.log((await dump(page)).filter(l=>/input|select|textarea/.test(l)&&!/^a /.test(l)).join("\n"));
await browser.close(); process.exit(0);
