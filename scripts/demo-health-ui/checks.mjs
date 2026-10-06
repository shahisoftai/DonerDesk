import { attach, BASE, dump } from "./lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const per = readFileSync("periods.txt","utf8").trim().split("\n"); const id = process.argv[2].length > 2 ? process.argv[2] : per[Number(process.argv[2])];
const { page, browser } = await attach();
await page.goto(`${BASE}/projects/${P}/reports/${id}`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(2500);
await page.getByRole("button", { name: /Report checks/ }).first().click(); await page.waitForTimeout(2000);
const t = await page.locator("body").innerText(); const i = t.indexOf("Report checks"); console.log(t.slice(i, i + 2800));
console.log((await dump(page)).filter(l=>/button|a /.test(l) && !/^a .*(projects\/[0-9a-f-]+ \||Settings|Team|Templates)/.test(l)).slice(-14).join("\n"));
await browser.close(); process.exit(0);
