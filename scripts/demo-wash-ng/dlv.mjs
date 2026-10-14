import { attach, BASE } from "../demo-ui/lib.mjs"; import { readFileSync, writeFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const F = readFileSync("periods.txt","utf8").trim().split("\n")[5]; const { page, ctx, browser } = await attach("dl");
await page.goto(`${BASE}/projects/${P}/reports/${F}/export`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(2000);
const hs = await page.locator("a").evaluateAll(a => a.map(x => x.getAttribute("href")).filter(h => /\/api\/files\/.*exports\//.test(h)));
const seen = new Set(); for (const h of [...new Set(hs)]) { const name = decodeURIComponent((h.match(/name=([^&]+)/) ?? [])[1] ?? h.split("/").pop()).replace(/^demo-8-safe-water-sanitation-and-hygiene-for-displaced-and-h-/, ""); if (seen.has(name)) continue; seen.add(name); const r = await ctx.request.get(BASE + h); const b = await r.body(); writeFileSync("/tmp/dd8v/" + name, b); console.log(r.status(), b.length, name); }
await browser.close(); process.exit(0);
