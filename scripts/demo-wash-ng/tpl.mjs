import { attach, BASE } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs"; import { resolve } from "node:path";
const P = readFileSync("pid.txt","utf8").trim(); const { page, browser } = await attach("tpl");
const [F, name, type] = process.argv.slice(2); const t0 = Date.now();
await page.goto(`${BASE}/projects/${P}/templates/new`); await page.waitForLoadState("networkidle");
await page.getByLabel("Template name").fill(name); await page.getByLabel("Donor", {exact:true}).fill("Lake Chad Basin Resilience Fund");
await page.getByLabel("Report type").selectOption({ label: type });
await page.locator('input[type=file]').setInputFiles(resolve(F));
await page.getByRole("button", { name: "Extract and review" }).click();
await page.waitForTimeout(6000); console.log(page.url());
for (let i=0;i<60;i++){ await page.waitForTimeout(6000); await page.goto(`${BASE}/projects/${P}/templates`); await page.waitForLoadState("networkidle"); const tt = await page.locator("main").innerText(); const seg = tt.split(name)[1] ?? ""; if (/Needs review|failed/i.test(seg.slice(0,300))) break; }
console.log("elapsed", Math.round((Date.now()-t0)/1000), "s"); console.log((await page.locator("main").innerText()).replace(/\n+/g," | ").split("Settings")[1].slice(0,900));
await browser.close(); process.exit(0);
