import { attach, BASE } from "./lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const { page, browser } = await attach();
for (const [who, role] of [["Najeeb","Project Manager"],["David","M&E Officer"],["Grace","Field Officer"]]) {
  await page.goto(`${BASE}/projects/${P}/team`); await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Assign member" }).click(); await page.waitForTimeout(800);
  const m = page.getByLabel("Member"); const opts = await m.locator("option").allInnerTexts(); const o = opts.find(x=>x.includes(who)); if(!o){console.log("missing",who,opts);continue;}
  await m.selectOption({ label: o }); await page.getByLabel("Project role").selectOption({ label: role });
  await page.getByRole("button", { name: "Assign", exact: true }).click(); await page.waitForTimeout(2500);
}
await page.goto(`${BASE}/projects/${P}/team`); await page.waitForLoadState("networkidle");
console.log((await page.locator("main").innerText()).split("Assign member")[1]?.slice(0,800));
await browser.close(); process.exit(0);
