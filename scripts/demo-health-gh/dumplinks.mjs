import { attach, BASE, dump } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const { page, browser } = await attach("dumplinks");
await page.goto(`${BASE}${process.argv[2].replace("{P}",P)}`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(1200);
if (process.argv[3]) { await page.getByRole("link", { name: process.argv[3] }).first().click(); await page.waitForLoadState("networkidle"); await page.waitForTimeout(1500); }
console.log(page.url()); console.log((await page.locator("main").innerText()).replace(/\n+/g," | ").slice(0,2500));
console.log((await dump(page)).filter(l=>!/^a .*\| (Projects|Reporting|Overview|Logframe|Activities|Evidence|Templates|Team|Settings) /.test(l)).slice(0,60).join("\n"));
await browser.close(); process.exit(0);
