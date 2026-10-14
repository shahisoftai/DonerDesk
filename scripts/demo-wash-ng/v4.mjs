import { attach, BASE } from "../demo-ui/lib.mjs"; import { writeFileSync } from "node:fs";
const [S, R] = process.argv.slice(2); const { page, browser } = await attach("v4");
await page.goto(`${BASE}/projects/${S}/reports/${R}`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(2000);
await page.getByRole("button", { name: /Generate( anyway)?|Yes, generate/ }).first().click(); await page.waitForTimeout(2500);
const w = page.getByRole("button", { name: /Yes, generate/ }); if (await w.count()) await w.click();
const t0 = Date.now(); await page.waitForTimeout(15000);
for (let i = 0; i < 20; i++) { const t = await page.locator("body").innerText(); if (!/being written|Writing sections|Writing your report/i.test(t)) break; await page.waitForTimeout(6000); }
const t = await page.locator("body").innerText(); writeFileSync("/tmp/dd8v/sit.txt", t); console.log(Math.round((Date.now()-t0)/1000), "s", /1,850/.test(t), "leaks:", t.match(/reporting officer|the inputs contain|situation context|sit-flood/gi));
console.log(t.slice(t.indexOf("OUTLINE"), t.indexOf("OUTLINE")+500).replace(/\n+/g," | "));
await browser.close(); process.exit(0);
