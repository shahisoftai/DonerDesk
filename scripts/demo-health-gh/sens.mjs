import { attach, BASE, dump } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const { page, browser } = await attach("sens");
await page.goto(`${BASE}/projects/${P}/evidence`); await page.waitForLoadState("networkidle"); await page.locator("#evidence-query").fill("maternal-death"); await page.getByRole("button", { name: "Apply" }).click(); await page.waitForTimeout(3000);
const hs = await page.locator('table a[href*="/evidence/"]').evaluateAll(a => a.map(x => x.textContent.trim() + " " + x.getAttribute("href"))); console.log(hs.slice(0,5));
const h = hs.find(x => /maternal/i.test(x)); if (h) { await page.goto(BASE + h.split(" ").pop()); await page.waitForLoadState("networkidle"); await page.waitForTimeout(1500);
 console.log((await page.locator("main").innerText()).replace(/\n+/g," | ").slice(0,1800)); console.log((await dump(page)).filter(l=>/button|select/.test(l)&&!/^a /.test(l)).slice(0,14).join("\n")); }
await browser.close(); process.exit(0);
