import { attach, BASE } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const per = readFileSync("periods.txt","utf8").trim().split("\n"); const { page, browser } = await attach("srcs");
await page.goto(`${BASE}/projects/${P}/reports/${per[Number(process.argv[2])]}`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(2500);
const n = await page.getByRole("heading", { name: new RegExp(process.argv[3]) }).count();
const h = page.getByRole("heading", { name: new RegExp(process.argv[3]) }).first(); await h.scrollIntoViewIfNeeded(); await h.click(); await page.waitForTimeout(1000);
await page.getByRole("tab", { name: /^Sources/ }).click().catch(async () => { await page.getByText(/^Sources/).first().click(); }); await page.waitForTimeout(1500);
const t = await page.locator("body").innerText(); const i = t.indexOf("Sources"); console.log(n, t.slice(i, i + 2500).replace(/\n+/g," | "));
await browser.close(); process.exit(0);
