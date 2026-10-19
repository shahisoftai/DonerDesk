import { attach, BASE, dump } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const per = readFileSync("periods.txt","utf8").trim().split("\n"); const id = per[Number(process.argv[2])]; const { page, browser } = await attach("checks");
await page.goto(`${BASE}/projects/${P}/reports/${id}`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(2500);
await page.getByRole("button", { name: /Report checks/ }).click(); await page.waitForTimeout(2500);
console.log((await page.locator("body").innerText()).split("Report checks").slice(-1)[0].replace(/\n+/g," | ").slice(0,2500));
console.log((await dump(page)).filter(l=>/button/.test(l)).slice(-14).join("\n"));
await browser.close(); process.exit(0);
