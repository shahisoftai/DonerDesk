import { attach, BASE } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const per = readFileSync("periods.txt","utf8").trim().split("\n"); const { page, browser } = await attach("chk3");
await page.goto(`${BASE}/projects/${P}/reports/${per[5]}`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(2500);
await page.getByRole("button", { name: /Finish \d+ remaining check/ }).click(); await page.waitForTimeout(2000);
const t = await page.locator("body").innerText(); const i = t.indexOf("Confidential information"); console.log(t.slice(i - 40, i + 900).replace(/\n+/g," | "));
await page.getByText("Review confidentiality").first().scrollIntoViewIfNeeded(); await page.screenshot({ path: "shot-checks6.png" });
await browser.close(); process.exit(0);
