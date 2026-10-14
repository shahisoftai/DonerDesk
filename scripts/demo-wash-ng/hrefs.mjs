import { attach, BASE } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const { page, browser } = await attach("hrefs");
await page.goto(BASE + process.argv[2].replace("$P",P)); await page.waitForLoadState("networkidle"); await page.waitForTimeout(1200);
const re = new RegExp(process.argv[3] ?? ".");
console.log((await page.locator("a").evaluateAll(a=>a.map(x=>x.textContent.trim().slice(0,50)+" "+x.getAttribute("href")))).filter(x=>re.test(x)).join("\n"));
await browser.close(); process.exit(0);
