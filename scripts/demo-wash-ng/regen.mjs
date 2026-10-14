import { attach, BASE, dump } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const per = readFileSync("periods.txt","utf8").trim().split("\n"); const id = process.argv[2].length > 2 ? process.argv[2] : per[Number(process.argv[2])];
const title = process.argv[3]; const instr = process.argv[4] ?? "";
const { page, browser } = await attach("regen");
await page.goto(`${BASE}/projects/${P}/reports/${id}`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(2500);
const h = page.getByRole("heading", { name: new RegExp(title) }).first(); await h.scrollIntoViewIfNeeded(); await h.click(); await page.waitForTimeout(800);
const sec = page.locator("section, article, div").filter({ has: h }).last();
await page.getByRole("button", { name: "Regenerate" }).first().click(); await page.waitForTimeout(1200);
console.log((await dump(page)).filter(l=>/textarea|input|button/.test(l) && /egenerate|nstruction|Cancel|Start|Write/i.test(l)).join("\n"));
if (instr) await page.getByRole("textbox", { name: /^Regenerate/ }).fill(instr);
await page.getByRole("button", { name: "Regenerate", exact: true }).last().click();
const t0 = Date.now(); await page.waitForTimeout(5000);
while (Date.now() - t0 < 95000) { const t = await page.locator("body").innerText(); if (!/being written|Writing sections|Regenerating|Writing/i.test(t)) break; await page.waitForTimeout(4000); }
await page.waitForTimeout(2000);
await browser.close(); process.exit(0);
