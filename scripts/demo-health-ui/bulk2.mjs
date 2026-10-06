import { attach, BASE, dump } from "./lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const per = readFileSync("periods.txt","utf8").trim().split("\n");
const { page, browser } = await attach();
await page.goto(`${BASE}/projects/${P}/compliance?period=${per[5]}`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(2500);
await page.getByRole("button", { name: "Bulk actions" }).click(); await page.waitForTimeout(800);
await page.getByLabel(/Select all/).check(); await page.waitForTimeout(500);
console.log((await dump(page)).filter(l=>/button|textarea/.test(l)&&!/^a /.test(l)&&/(Resolve|Accept|Start|Apply|note|Confirm|Not applicable|Exit)/i.test(l)).slice(0,10).join("\n"));
await page.getByRole("button", { name: "Resolve", exact: true }).first().click(); await page.waitForTimeout(1000);
console.log((await dump(page)).filter(l=>/textarea|Confirm|Apply|Resolve|Cancel/.test(l)&&!/^a /.test(l)).slice(0,8).join("\n"));
await page.locator("textarea").first().fill("Attested by the project manager at close-out: sensitive file (maternal death summary) is marked highly sensitive and excluded from exports; procurement register uploaded; report content reviewed section by section; environmental mitigation reported in section 6; submission planned within 30 days of the end date; unsupported-claim item refers to superseded wording.");
const c = page.getByRole("button", { name: /^(Confirm|Apply|Resolve \d)/ }); console.log(await c.allInnerTexts()); await c.last().click(); await page.waitForTimeout(2500); await page.screenshot({path:"bulk2.png"}); console.log((await dump(page)).filter(l=>/button/.test(l)&&/(Confirm|Yes|Apply|Resolve \d|Cancel)/.test(l)).slice(0,8).join("\n")); const c2 = page.getByRole("button", { name: /^(Confirm|Yes)/ }); if (await c2.count()) { await c2.last().click(); await page.waitForTimeout(5000); }
console.log((await page.locator("main").innerText()).slice(0,700).replace(/\n+/g," | "));
await browser.close(); process.exit(0);
