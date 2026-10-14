import { attach, BASE } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const { page, browser } = await attach("next1");
for (let i = 0; i < Number(process.argv[2] ?? 1); i++) {
  await page.goto(`${BASE}/projects/${P}/reports`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(1500);
  await page.getByRole("button", { name: "Create just the next one" }).click(); await page.waitForTimeout(5000);
}
await page.goto(`${BASE}/projects/${P}/reports`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(1500);
console.log((await page.locator("main").innerText()).replace(/\n+/g," | ").split("Settings")[1]?.slice(0,1800));
console.log((await page.locator("a").evaluateAll(a=>a.map(x=>x.textContent.trim().slice(0,40)+" "+x.getAttribute("href")).filter(x=>/reports\/[0-9a-f-]{36}|new/.test(x)))).join("\n"));
await browser.close(); process.exit(0);
