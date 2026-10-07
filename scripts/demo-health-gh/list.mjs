import { attach, BASE } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const { page, browser } = await attach("list");
await page.goto(`${BASE}${process.argv[2].replace("{P}",P)}`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(1500);
console.log((await page.locator("main").innerText()).replace(/\n+/g," | ").slice(0,+process.argv[3]||3000));
await browser.close(); process.exit(0);
