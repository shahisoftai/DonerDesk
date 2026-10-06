import { attach, BASE } from "./lib.mjs"; import { readFileSync, appendFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const { page, browser } = await attach();
await page.goto(`${BASE}/projects/${P}/reports/closing`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(1500);
await page.getByRole("button", { name: /Start the closing report/ }).click(); await page.waitForTimeout(9000);
console.log(page.url()); const m = page.url().match(/reports\/([0-9a-f-]{36})/); if (m) appendFileSync("periods.txt", m[1] + "\n");
console.log((await page.locator("main").innerText()).slice(0, 800));
await browser.close(); process.exit(0);
