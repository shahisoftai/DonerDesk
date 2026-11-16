import { attach } from "../lib.mjs";
import { readFileSync } from "node:fs";
const { page, shot, browser } = await attach("s4b");
const rows = readFileSync(new URL("../inputs/indicators.csv", import.meta.url), "utf8").trim().split("\n").slice(1).map(l => l.split(","));
const sv = page.getByLabel("Starting value", { exact: true }), bt = page.getByLabel("Better when", { exact: true });
for (let i = 0; i < rows.length; i++) {
  if (rows[i][2] === "PERCENTAGE") continue;
  await sv.nth(i).fill("1"); await sv.nth(i).fill("0"); await sv.nth(i).press("Tab"); await page.waitForTimeout(250);
}
await bt.nth(54).selectOption({ label: "Lower" }); await bt.nth(54).selectOption({ label: "Higher" }); await page.waitForTimeout(500);
const t = await page.locator("main").innerText(); console.log(t.slice(t.indexOf("Still to answer")).split("\n").filter(l=>/Indicator|better|Choose/.test(l)).slice(0,8));
await browser.close();
