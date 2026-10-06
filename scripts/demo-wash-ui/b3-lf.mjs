import { attach, BASE, dump } from "./lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid3.txt", "utf8").trim(); const { page, browser } = await attach();
await page.goto(`${BASE}/projects/${P}/logframe/import`); await page.waitForLoadState("networkidle");
await page.locator('input[type=file]').setInputFiles(process.argv[2]); await page.waitForTimeout(4000);
console.log((await dump(page)).filter(l=>!/^a /.test(l)).join("\n")); console.log((await page.locator("main").innerText()).slice(300, 2500));
await page.screenshot({ path: "lfimp.png" });
await browser.close(); process.exit(0);
