import { attach, BASE } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const { page, browser } = await attach("tapprove");
await page.goto(`${BASE}/projects/${P}/templates/${process.argv[2]}`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(1500);
await page.getByRole("button", { name: "Accept all" }).click(); await page.waitForTimeout(1000);
await page.getByRole("button", { name: "Save changes" }).click(); await page.waitForTimeout(3000);
await page.getByRole("button", { name: "Approve template" }).click(); await page.waitForTimeout(4000);
console.log((await page.locator("main").innerText()).replace(/\n+/g," | ").split("Settings")[1].slice(0,500));
await browser.close(); process.exit(0);
