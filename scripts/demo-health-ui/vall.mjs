import { attach, BASE } from "./lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const per = readFileSync("periods.txt","utf8").trim().split("\n"); const m = Number(process.argv[2]);
const { page, browser } = await attach();
await page.goto(`${BASE}/projects/${P}/reports/${per[m]}/inputs`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(1500);
const b = page.getByRole("button", { name: /Verify all \(\d+\)/ }); console.log(await b.allInnerTexts());
await b.click(); await page.waitForTimeout(9000);
const t = await page.locator("main").innerText(); console.log(t.split("\n").filter(l=>/verified|cannot|could not|reason|failed|needs/i.test(l)).slice(0,12).join("\n"));
console.log("Verified rows:", (t.match(/\tVerified\t/g)||[]).length, "Draft rows:", (t.match(/\tDraft\t/g)||[]).length);
await browser.close(); process.exit(0);
