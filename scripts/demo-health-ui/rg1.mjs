import { attach, BASE, dump } from "./lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const per = readFileSync("periods.txt","utf8").trim().split("\n");
const { page, browser } = await attach();
await page.goto(`${BASE}/projects/${P}/reports/${per[2]}`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(2500);
const h = page.getByRole("heading", { name: /^1 Executive Summary/ }).first(); await h.click(); await page.waitForTimeout(600);
await page.getByRole("button", { name: "Regenerate", exact: true }).first().click(); await page.waitForTimeout(1500);
console.log((await dump(page)).filter(l=>/button|textarea/.test(l)&&/(egenerate|Cancel|Reopen|Confirm|Continue)/.test(l)).join("\n"));
console.log((await page.locator("[role=dialog]").allInnerTexts()).join("|").slice(0,600));
await browser.close(); process.exit(0);
