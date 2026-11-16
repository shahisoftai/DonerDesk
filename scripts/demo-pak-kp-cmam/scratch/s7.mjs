import { attach } from "../lib.mjs";
import { readFileSync } from "node:fs";
const { page, shot, browser } = await attach("s7");
page.setDefaultTimeout(15000);
const rows = readFileSync(new URL("../inputs/indicators.csv", import.meta.url), "utf8").trim().split("\n").slice(1).map(l => l.split(","));
await page.getByRole("button", { name: /^7\. / }).first().click(); await page.waitForTimeout(1200);
const sels = page.locator("main select").filter({ has: page.locator("option", { hasText: "A form in the field" }) });
console.log("selects", await sels.count());
for (let i = 0; i < rows.length; i++) { await sels.nth(i).selectOption({ label: rows[i][2] === "PERCENTAGE" ? "Typed in" : "A form in the field" }); await page.waitForTimeout(250); }
const t = await page.locator("main").innerText(); const j = t.indexOf("How values are checked"); console.log(t.slice(j, j + 1500)); console.log(t.slice(t.indexOf("Still to answer")).slice(0, 400));
await shot("s7"); await browser.close();
