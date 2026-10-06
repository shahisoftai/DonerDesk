import { attach, BASE, dump } from "./lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const per = readFileSync("periods.txt","utf8").trim().split("\n");
const { page, browser } = await attach();
await page.goto(`${BASE}/projects/${P}/compliance?period=${per[5]}`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(2500);
console.log((await page.locator("main").innerText()).split("Bulk actions")[0].slice(-200));
await page.getByRole("button", { name: "Bulk actions" }).click(); await page.waitForTimeout(800);
console.log((await dump(page)).filter(l=>/button|textarea|checkbox/.test(l)&&!/^a /.test(l)).slice(0,14).join("\n"));
await browser.close(); process.exit(0);
