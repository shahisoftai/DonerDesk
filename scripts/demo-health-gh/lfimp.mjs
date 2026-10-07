import { attach, BASE } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs"; import { resolve } from "node:path";
const P = readFileSync("pid.txt","utf8").trim(); const { page, browser } = await attach("lfimp");
await page.goto(`${BASE}/projects/${P}/logframe/import`); await page.waitForLoadState("networkidle");
await page.locator("input[type=file]").setInputFiles(resolve("logframe.csv")); await page.waitForTimeout(4000);
console.log((await page.locator("main").innerText()).slice(0,3000));
if (process.argv[2] === "go") { await page.getByRole("button", { name: "Create logframe items" }).click(); await page.waitForTimeout(9000); console.log(page.url()); console.log((await page.locator("main").innerText()).slice(0,2500)); }
await browser.close(); process.exit(0);
