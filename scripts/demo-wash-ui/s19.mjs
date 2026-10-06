import { attach, BASE } from "./lib.mjs"; import { readFileSync, appendFileSync } from "node:fs";
const P = readFileSync("pid.txt", "utf8").trim(); const { page, browser } = await attach();
await page.goto(`${BASE}/projects/${P}/reports/closing`); await page.waitForLoadState("networkidle");
await page.getByRole("button", { name: "Start the closing report" }).click(); await page.waitForTimeout(6000);
console.log(page.url()); const id = page.url().match(/reports\/([0-9a-f-]{36})/)?.[1]; if (id) appendFileSync("periods.txt", id + "\n");
console.log((await page.locator("main").innerText()).slice(300, 2500));
await browser.close(); process.exit(0);
