import { attach } from "../lib.mjs";
import { readFileSync } from "node:fs";
const { page, browser } = await attach("s4c");
const rows = readFileSync(new URL("../inputs/indicators.csv", import.meta.url), "utf8").trim().split("\n").slice(1).map(l => l.split(","));
const k = page.getByLabel("Kind of number", { exact: true });
for (let i = 0; i < rows.length; i++) { if (rows[i][2] === "PERCENTAGE") continue; await k.nth(i).selectOption({ label: "Number" }); await page.waitForTimeout(200); }
await page.waitForTimeout(1000);
const t = await page.locator("main").innerText(); console.log(t.slice(t.indexOf("Still to answer")).split("\n").filter(l=>/Indicator|better|Choose|INDIC/.test(l)).slice(0,8));
await browser.close();
