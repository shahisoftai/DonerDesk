import { attach, BASE, dump } from "./lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const per = readFileSync("periods.txt","utf8").trim().split("\n"); const m = Number(process.argv[2]); const id = process.argv[3] ?? per[m];
const { page, browser } = await attach(); const txt = JSON.parse(readFileSync("fieldrep.json","utf8"))[m];
await page.goto(`${BASE}/projects/${P}/reports/${id}/inputs?tab=import`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(1200);
const ff = page.getByRole("button", { name: "From field report" }); if (await ff.count()) { await ff.click(); await page.waitForTimeout(600); }
await page.locator("textarea").first().fill(txt);
await page.getByRole("button", { name: "Extract" }).click(); await page.waitForTimeout(25000);
console.log((await page.locator("main").innerText()).split("Flexible inputs")[1].slice(0, 2500)); console.log((await dump(page)).filter(l=>/button|checkbox/.test(l) && !/^a /.test(l)).join("\n"));
await browser.close(); process.exit(0);
