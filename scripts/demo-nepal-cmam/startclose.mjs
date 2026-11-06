import { attach, BASE } from "../demo-ui/lib.mjs"; import { readFileSync, writeFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const { page, browser } = await attach("startclose");
await page.goto(`${BASE}/projects/${P}/reports/closing`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(1500);
await page.getByRole("button", { name: /Start the closing report/ }).click(); await page.waitForTimeout(9000);
console.log(page.url()); const m = page.url().match(/reports\/([0-9a-f-]{36})/);
if (m) { const lines = readFileSync("periods.txt","utf8").trim().split("\n"); lines[5] = m[1]; writeFileSync("periods.txt", lines.join("\n") + "\n"); }
console.log((await page.locator("main").innerText()).replace(/\n+/g," | ").slice(0, 900));
await browser.close(); process.exit(0);
