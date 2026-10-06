import { attach, BASE, dump } from "./lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const { page, browser } = await attach();
await page.goto(`${BASE}/projects/${P}/setup`); await page.waitForLoadState("networkidle");
const b = page.getByRole("button", { name: "Mark setup complete" }); if (await b.count()) { await b.click(); await page.waitForTimeout(3000); }
console.log((await page.locator("main").innerText()).split("Setup status")[1]?.slice(0,500));
await page.goto(`${BASE}/projects/${P}/reports`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(3000);
console.log((await page.locator("main").innerText()).split("Settings")[1]?.slice(0,3500)); console.log((await dump(page)).filter(l=>!/^a .*\/projects\/[^/]+ \|/.test(l)).join("\n"));
await browser.close(); process.exit(0);
