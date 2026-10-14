import { attach, BASE } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const per = readFileSync("periods.txt","utf8").trim().split("\n"); const id = per[Number(process.argv[2])]; const { page, browser } = await attach("selfappr");
await page.goto(`${BASE}/projects/${P}/reports/${id}`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(2500);
await page.getByRole("button", { name: /^Submit for review/ }).first().click(); await page.waitForTimeout(2500);
let dlg = page.locator("[role=dialog]"); if (await dlg.count()) { console.log("SUBMIT DIALOG:", (await dlg.first().innerText()).replace(/\n+/g," | ").slice(0,300)); const c = dlg.first().getByRole("button", { name: /^(Confirm|Submit|Send)/ }); if (await c.count()) await c.last().click(); await page.waitForTimeout(4000); }
let t = await page.locator("body").innerText(); console.log("STATE:", t.slice(t.indexOf("Version"), t.indexOf("OUTLINE")).replace(/\n+/g," | ").slice(0,200));
const a = page.getByRole("button", { name: /^Approve report/ }); console.log("author sees Approve button:", await a.count());
if (await a.count()) { await a.first().click(); await page.waitForTimeout(2000); dlg = page.locator("[role=dialog]"); if (await dlg.count()) { const c = dlg.first().getByRole("button", { name: /^Approve report/ }); await c.last().click(); await page.waitForTimeout(3500); } }
t = await page.locator("body").innerText(); console.log("AFTER SELF-APPROVE:", t.slice(t.indexOf("Version"), t.indexOf("OUTLINE")).replace(/\n+/g," | ").slice(0,200));
console.log("MESSAGES:", (await page.locator("[role=alert], [role=status], .toast, [class*=toast]").allInnerTexts()).join(" // ").slice(0,400));
await page.screenshot({ path: "shot-selfappr.png" });
await browser.close(); process.exit(0);
