import { attach, BASE } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const { page, browser } = await attach("chk");
await page.goto(`${BASE}/projects/${P}/logframe`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(2000);
const t = await page.locator("main").innerText(); console.log((t.match(/\d+ indicators?/g)||[]).join(","), (t.match(/KE-OP[\d.]+|KE-OC1/g)||[]).join(","), t.includes("Activate project"));
await page.goto(`${BASE}/projects/${P}`); await page.waitForLoadState("networkidle");
const b = page.getByRole("button",{name:"Activate project"}); if (await b.count()) { await b.click(); await page.waitForTimeout(4000); }
await page.goto(`${BASE}/projects/${P}/reports`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(2000);
console.log((await page.locator("main").innerText()).replace(/\n+/g," | ").slice(0,1200));
await browser.close(); process.exit(0);
