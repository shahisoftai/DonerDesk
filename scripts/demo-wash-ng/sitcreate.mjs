import { attach, BASE } from "../demo-ui/lib.mjs"; import { readFileSync, appendFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const { page, browser } = await attach("sitcreate");
await page.goto(`${BASE}/projects/${P}/reports/new`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(1200);
await page.getByLabel("Report type").selectOption({ label: "Situation report" }); await page.waitForTimeout(1000);
await page.getByLabel("Event / situation").fill("Flooding and cholera alert in Jere and Konduga LGAs, August 2026");
await page.getByLabel("Situation date (as of)").fill("2026-08-15");
await page.getByLabel("Location / affected area (optional)").fill("Jere and Konduga LGAs");
await page.getByLabel("Situation summary (optional)").fill("Floods since early August damaged one water point, contaminated three others and cut latrine access for about 400 households in Jere and Konduga; the July cholera alert remains in force.");
await page.getByLabel("Main needs (optional)").fill("Safe water and chlorination at flooded water points\nHygiene kits and water treatment for affected households\nRaised latrine access paths");
await page.getByRole("button", { name: /Add figure/ }).click(); await page.waitForTimeout(600);
const { dump } = await import("../demo-ui/lib.mjs"); console.log((await dump(page)).filter(l=>/input|select/.test(l)&&/igure|ource|abel|alue|Date|date/i.test(l)).slice(0,10).join("\n"));
await page.getByLabel("Figure 1").fill("Households affected by the floods in Jere and Konduga: 1,850"); await page.getByLabel("Source 1").fill("Borno State flood rapid assessment, 14 August 2026"); await page.getByLabel("As of 1").fill("2026-08-14");
const us = page.getByRole("button", { name: /Use the suggested dates/ }); if (await us.count()) { await us.click(); await page.waitForTimeout(600); }
await page.screenshot({path:"shot-sit1.png"}); await page.getByRole("button", { name: "Create period" }).click(); await page.waitForTimeout(7000); console.log(page.url()); console.log("ALERTS:", (await page.locator("[role=alert], [aria-live], .text-red-600, .text-rose-600, .text-danger").allInnerTexts()).join(" // ").slice(0,500)); await page.screenshot({path:"shot-sit2.png"});
const m = page.url().match(/reports\/([0-9a-f-]{36})/); if (m) appendFileSync("situation.txt", m[1] + "\n");
console.log((await page.locator("main").innerText()).replace(/\n+/g," | ").slice(0,600));
await browser.close(); process.exit(0);
