import { attach, BASE } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs"; import { IND } from "./data.mjs";
const P = readFileSync("pid.txt","utf8").trim(); const { page, browser } = await attach("direction");
await page.goto(`${BASE}/projects/${P}/logframe`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(1200);
const links = await page.locator("a").evaluateAll(a=>a.map(x=>[x.textContent.trim(), x.getAttribute("href")]).filter(x=>/\/indicators\/[0-9a-f-]{36}$/.test(x[1])));
for (const i of IND.filter(i => i[2] === "Percentage")) {
  const l = links.find(x => i[1].startsWith(x[0].slice(0, 45))); if (!l) { console.log("no link", i[0]); continue; }
  await page.goto(BASE + l[1]); await page.waitForLoadState("networkidle"); await page.waitForTimeout(800);
  await page.getByLabel("Direction of progress").selectOption({ label: i[12] ? "Higher is better" : "Lower is better" });
  await page.getByRole("button", { name: "Save calculation" }).click(); await page.waitForTimeout(2000);
  const t = await page.locator("main").innerText(); console.log(i[0], i[12] ? "higher" : "LOWER", "|", (t.match(/Calculation (confirmed|needs review)/) ?? [""])[0], "|", (t.match(/Rate:[^\n]*/) ?? [""])[0].slice(0,100));
}
await browser.close(); process.exit(0);
