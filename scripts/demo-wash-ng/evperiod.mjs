import { attach, BASE } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const { page, browser } = await attach("evperiod");
await page.goto(`${BASE}/projects/${P}/evidence`); await page.waitForLoadState("networkidle"); await page.locator("#evidence-query").fill("sit-flood"); await page.getByRole("button", { name: "Apply" }).click(); await page.waitForTimeout(3000);
const rows = page.locator("tbody tr"); const n = await rows.count(); console.log("rows", n);
for (let i = 0; i < n; i++) { const r = rows.nth(i); const sel = r.getByLabel(/Reporting period/); if (await sel.count()) { await sel.selectOption({ label: "Situation · Aug 2026" }); await page.waitForTimeout(1500); console.log("period set row", i, (await r.innerText()).replace(/\n+/g," | ").slice(0,160)); } }
await page.getByRole("button", { name: /Select all \d+ awaiting verification/ }).click().catch(()=>console.log("no select-all")); await page.waitForTimeout(500);
const vs = page.getByRole("button", { name: "Verify selected" }); if (await vs.count()) { await vs.click(); await page.waitForTimeout(2500); const c = page.getByRole("button", { name: /^(Confirm|Verify)/ }); console.log(await c.allInnerTexts()); }
console.log((await page.locator("main").innerText()).replace(/\n+/g," | ").slice(-600));
await browser.close(); process.exit(0);
