import { attach, BASE } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const { page, browser } = await attach("reopen");
await page.goto(`${BASE}/projects/${P}/activities/98cbbcca-a4c3-4932-b4c4-af3a047a3cea`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(1500);
const t = await page.locator("main").innerText(); console.log("panels:", /Something wrong in this accepted record/.test(t), /Replaced or entered by mistake/.test(t));
await page.getByRole("button", { name: "Reopen for correction" }).click(); await page.getByLabel("What needs to be corrected?").fill("Link this record to planned activity A1.1.");
await page.getByRole("button", { name: "Send back for correction" }).click(); await page.waitForTimeout(3500);
console.log((await page.locator("main").innerText()).replace(/\n+/g," | ").match(/[^|]*(cannot be|approved using)[^|]*/)?.[0]);
await page.screenshot({path:"shot-reopen.png"});
await browser.close(); process.exit(0);
