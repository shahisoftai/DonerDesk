import { attach, BASE, dump } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const per = readFileSync("periods.txt","utf8").trim().split("\n"); const id = per[Number(process.argv[2])]; const title = process.argv[3];
const { page, browser } = await attach("regen3");
await page.goto(`${BASE}/projects/${P}/reports/${id}`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(2500);
const h = page.getByRole("heading", { name: new RegExp(title) }).first(); await h.scrollIntoViewIfNeeded(); await h.click(); await page.waitForTimeout(800);
console.log((await dump(page)).filter(l=>/button/.test(l)&&/(egenerate|Edit|Rewrite|Reopen)/.test(l)).join("\n"));
await page.getByRole("button", { name: "Regenerate", exact: true }).first().click(); await page.waitForTimeout(1500);
console.log((await page.locator("[role=dialog], form").allInnerTexts()).join(" || ").replace(/\n+/g," | ").slice(0,500));
await browser.close(); process.exit(0);
