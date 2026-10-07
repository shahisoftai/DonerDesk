import { attach, BASE } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const per = readFileSync("periods.txt","utf8").trim().split("\n"); const id = per[Number(process.argv[2])]; const { page, browser } = await attach("menu");
await page.goto(`${BASE}/projects/${P}/reports/${id}`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(2500);
const btns = await page.locator("button").evaluateAll(b => b.slice(0,14).map(x => (x.getAttribute("aria-label")||"") + "|" + x.textContent.trim().slice(0,50))); console.log(btns.join("\n"));
await page.locator('button[aria-label*="ore"]').first().click().catch(()=>console.log("no more btn")); await page.waitForTimeout(800);
console.log((await page.locator('[role=menu]').allInnerTexts()).join("\n---\n"));
await browser.close(); process.exit(0);
