import { attach, BASE, dump } from "./lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const per = readFileSync("periods.txt","utf8").trim().split("\n"); const id = process.argv[2].length > 2 ? process.argv[2] : per[Number(process.argv[2])];
const { page, browser } = await attach();
const show = async (tag) => { const t = await page.locator("body").innerText(); const i = t.indexOf("% ready"); console.log(tag, t.slice(Math.max(0,i-12), i+80).replace(/\n+/g," | ")); };
await page.goto(`${BASE}/projects/${P}/reports/${id}`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(2500); await show("start");
const act = async (name) => { const b = page.getByRole("button", { name }); if (await b.count()) { await b.first().click(); await page.waitForTimeout(5000); return true; } return false; };
for (let k = 0; k < 6; k++) {
  if (await act(/^Approve all clean sections/)) { await show("approved"); continue; }
  if (await act(/^Approve \d+ remaining sections?/)) {
    for (let j = 0; j < 10; j++) { const a = page.getByRole("button", { name: "Approve section", exact: true }); if (!(await a.count())) break; await a.first().click(); await page.waitForTimeout(3000); const n = page.getByRole("button", { name: /^Approve \d+ remaining sections?/ }); if (!(await n.count())) break; await n.first().click(); await page.waitForTimeout(2000); }
    await show("approved-remaining"); continue; }
  break;
}
if (process.argv[3] === "submit") { if (await act(/^Submit for review/)) await show("submitted"); await page.waitForTimeout(2000); await show("after"); console.log((await dump(page)).filter(l=>/button/.test(l) && /(Approve|Submit|Export|Request)/i.test(l)).join("\n")); }
await browser.close(); process.exit(0);
