import { attach, BASE, dump } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const per = readFileSync("periods.txt","utf8").trim().split("\n"); const id = per[Number(process.argv[2])]; const { page, browser } = await attach("finish");
await page.goto(`${BASE}/projects/${P}/reports/${id}`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(2500);
await page.getByRole("button", { name: /Finish \d+ remaining check/ }).click(); await page.waitForTimeout(3500);
const t = await page.locator("body").innerText(); console.log(page.url()); console.log(t.slice(t.indexOf("OUTLINE")).replace(/\n+/g," | ").slice(0,300)); 
await page.screenshot({ path: "/tmp/dd7-finish.png" });
const dlg = await page.locator("[role=dialog]").allInnerTexts(); console.log(dlg.join("\n---\n").slice(0,1500));
await browser.close(); process.exit(0);
