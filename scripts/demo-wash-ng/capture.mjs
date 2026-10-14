import { attach, BASE } from "../demo-ui/lib.mjs"; import { readFileSync, writeFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const { page, browser } = await attach("capture");
await page.goto(`${BASE}/projects/${P}/reports`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(1500);
const b = page.getByRole("button", { name: /^Create the period$/ }); if (process.argv[2] === "create" && await b.count()) { await b.click(); await page.waitForTimeout(5000); await page.goto(`${BASE}/projects/${P}/reports`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(1500); }
const cards = await page.locator("main").evaluate(m => [...m.querySelectorAll("a")].filter(a => a.textContent.trim()==="Open workspace").map(a => { const c = a.closest("li,article,div[class*=border]"); return a.getAttribute("href").split("/").pop() + " | " + (c?.innerText ?? "").replace(/\n+/g," ").slice(0,90); }));
console.log(cards.join("\n"));
await browser.close(); process.exit(0);
