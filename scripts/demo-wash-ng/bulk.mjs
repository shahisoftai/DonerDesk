import { attach, BASE } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const id = readFileSync("periods.txt","utf8").trim().split("\n")[5]; const { page, browser } = await attach("bulk");
await page.goto(`${BASE}/projects/${P}/compliance?period=${id}`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(2500);
await page.getByRole("button", { name: "Bulk actions" }).click(); await page.waitForTimeout(800);
await page.getByLabel(/Select all/).check(); await page.waitForTimeout(500);
await page.getByRole("button", { name: "Resolve", exact: true }).first().click(); await page.waitForTimeout(1000);
await page.locator("textarea").first().fill("Attested at close-out by the project manager (demo run): the March safety audit is marked highly sensitive and is excluded from every export; the report content was reviewed section by section; the five completion certificates and the distribution lists are on file; the report assesses results against the logframe and the SPHERE minimum standards; September activity records are accepted.");
const c = page.getByRole("button", { name: /^(Confirm|Apply|Resolve \d)/ }); console.log(await c.allInnerTexts()); await c.last().click(); await page.waitForTimeout(3000);
const c2 = page.getByRole("button", { name: /^(Confirm|Yes|Resolve \d)/ }); if (await c2.count()) { console.log(await c2.allInnerTexts()); await c2.last().click(); await page.waitForTimeout(3000); }
console.log((await page.locator("main").innerText()).replace(/\n+/g," | ").slice(0,500));
await browser.close(); process.exit(0);
