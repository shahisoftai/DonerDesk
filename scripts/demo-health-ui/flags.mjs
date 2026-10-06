import { attach, BASE, dump } from "./lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const per = readFileSync("periods.txt","utf8").trim().split("\n"); const id = process.argv[2].length > 2 ? process.argv[2] : per[Number(process.argv[2])];
const { page, browser } = await attach();
await page.goto(`${BASE}/projects/${P}/reports/${id}`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(2500);
await page.getByRole("button", { name: /^Review \d+ flagged/ }).first().click(); await page.waitForTimeout(2500);
const t = await page.locator("body").innerText(); console.log(t.slice(t.lastIndexOf("Section ")).slice(0, 3500));
console.log((await dump(page)).filter(l=>/button|textarea|radio/.test(l) && !/^a /.test(l) && /(Keep|Use|Edit|Leave|Resolve|decid|note|Accept|Apply)/i.test(l)).join("\n"));
await page.screenshot({ path: "flags.png" });
await browser.close(); process.exit(0);
