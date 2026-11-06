import { attach, BASE, dump } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const per = readFileSync("periods.txt","utf8").trim().split("\n"); const id = process.argv[2].length > 2 ? process.argv[2] : per[Number(process.argv[2])];
const { page, browser } = await attach("gen");
await page.goto(`${BASE}/projects/${P}/reports/${id}`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(1500);
await page.getByRole("button", { name: "Generate report" }).first().click(); await page.waitForTimeout(2500);
console.log((await dump(page)).filter(l=>/button/.test(l)).join("\n"));
console.log((await page.locator("body").innerText()).slice(0, 1500));
await browser.close(); process.exit(0);
