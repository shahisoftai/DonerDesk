import { attach, BASE, dump } from "./lib.mjs"; import { readFileSync } from "node:fs"; import { resolve } from "node:path";
const P = readFileSync("pid.txt","utf8").trim(); const { page, browser } = await attach();
const [F, name, type] = process.argv.slice(2);
await page.goto(`${BASE}/projects/${P}/templates/new`); await page.waitForLoadState("networkidle");
await page.getByLabel("Template name").fill(name); await page.getByLabel("Donor", {exact:true}).fill("USAID");
await page.getByLabel("Report type").selectOption({ label: type });
await page.locator('input[type=file]').setInputFiles(resolve(F));
await page.getByRole("button", { name: "Extract and review" }).click();
await page.waitForTimeout(8000);
console.log(page.url());
for (let i=0;i<30;i++){ await page.waitForTimeout(6000); await page.goto(`${BASE}/projects/${P}/templates`); await page.waitForLoadState("networkidle"); const tt = await page.locator("main").innerText(); if (/Needs review/.test(tt.split(name)[1] ?? "")) break; }
await page.waitForLoadState("networkidle"); await page.waitForTimeout(2000);
console.log((await page.locator("main").innerText()).slice(-800));
await browser.close(); process.exit(0);
