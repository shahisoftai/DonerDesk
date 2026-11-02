import { attach, BASE } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const { page, browser } = await attach("lfimp");
await page.goto(`${BASE}/projects/${P}/logframe/import`); await page.waitForLoadState("networkidle");
await page.getByLabel("Or paste or dictate it here").fill(readFileSync("logframe.csv","utf8")); await page.waitForTimeout(3500);
console.log((await page.locator("main").innerText()).replace(/\n+/g," | ").slice(0,2200));
if (process.argv[2] === "go") { await page.getByRole("button", { name: "Create logframe items" }).click(); await page.waitForTimeout(9000); console.log(page.url()); console.log((await page.locator("main").innerText()).replace(/\n+/g," | ").slice(0,1800)); }
await browser.close(); process.exit(0);
