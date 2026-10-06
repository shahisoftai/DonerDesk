import { attach, BASE, dump } from "./lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const per = readFileSync("periods.txt","utf8").trim().split("\n"); const id = process.argv[2].length > 2 ? process.argv[2] : per[Number(process.argv[2])];
const { page, browser } = await attach();
await page.goto(`${BASE}/projects/${P}/reports/${id}`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(2500);
const b = page.getByRole("button", { name: /Approve all clean sections/ }); if (await b.count()) { await b.first().click(); await page.waitForTimeout(6000); }
const t = await page.locator("body").innerText(); const i = t.indexOf("% ready"); console.log(t.slice(Math.max(0,i-30), i+200).replace(/\n+/g," | "));
console.log((await dump(page)).filter(l=>/button/.test(l) && /(Approve|Submit|Finish|Review|Export|checks)/i.test(l)).join("\n"));
await browser.close(); process.exit(0);
