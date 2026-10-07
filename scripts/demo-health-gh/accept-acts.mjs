import { attach, BASE, dump } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const { page, browser } = await attach("accept-acts");
await page.goto(`${BASE}/projects/${P}/activities`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(1500);
await page.getByRole("button", { name: "Select all waiting" }).click(); await page.waitForTimeout(800);
console.log((await dump(page)).filter(l=>/button|textarea/.test(l)).join("\n"));
const note = page.getByLabel(/note/i); if (await note.count()) await note.first().fill(process.argv[2] ?? "Records checked against attendance sheets and registers; accepted.");
await page.getByRole("button", { name: /Accept \d+ selected/ }).click(); await page.waitForTimeout(6000);
console.log((await page.locator("main").innerText()).split("Activity updates")[1].slice(0,1500));
await browser.close(); process.exit(0);
