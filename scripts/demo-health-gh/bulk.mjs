import { attach, BASE } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const id = readFileSync("periods.txt","utf8").trim().split("\n").pop(); const { page, browser } = await attach("bulk");
await page.goto(`${BASE}/projects/${P}/compliance?period=${id}`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(2500);
await page.getByRole("button", { name: "Bulk actions" }).click(); await page.waitForTimeout(800);
await page.getByLabel(/Select all/).check(); await page.waitForTimeout(500);
await page.getByRole("button", { name: "Resolve", exact: true }).first().click(); await page.waitForTimeout(1000);
await page.locator("textarea").first().fill("Attested by the project manager at close-out: the maternal death review summary is marked highly sensitive and is excluded from every export; the final procurement and expenditure register is uploaded and verified; report content was read and approved section by section; beneficiary counts are disaggregated by sex in the output tables; the report follows the formal EU register.");
const c = page.getByRole("button", { name: /^(Confirm|Apply|Resolve \d)/ }); console.log(await c.allInnerTexts()); await c.last().click(); await page.waitForTimeout(3000);
const c2 = page.getByRole("button", { name: /^(Confirm|Yes|Resolve \d)/ }); if (await c2.count()) { console.log(await c2.allInnerTexts()); await c2.last().click(); await page.waitForTimeout(3000); }
console.log((await page.locator("main").innerText()).replace(/\n+/g," | ").slice(0,500));
await browser.close(); process.exit(0);
