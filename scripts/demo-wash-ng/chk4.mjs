import { attach, BASE } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const per = readFileSync("periods.txt","utf8").trim().split("\n"); const { page, browser } = await attach("chk4");
await page.goto(`${BASE}/projects/${P}/reports/${per[5]}`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(2500);
await page.getByRole("button", { name: /Finish \d+ remaining check/ }).click(); await page.waitForTimeout(2000);
const btn = page.getByRole("button", { name: "Review confidentiality" }).first(); const href = await page.getByRole("link", { name: "Review confidentiality" }).first().getAttribute("href").catch(()=>null); console.log("href:", href, "button count:", await btn.count());
await (await btn.count() ? btn : page.getByRole("link", { name: "Review confidentiality" }).first()).click(); await page.waitForTimeout(3500); console.log(page.url());
await page.screenshot({ path: "shot-conf.png" });
console.log((await page.locator("main").innerText()).replace(/\n+/g," | ").slice(0, 700));
await browser.close(); process.exit(0);
