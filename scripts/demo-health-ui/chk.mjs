import { attach, BASE } from "./lib.mjs"; import { readFileSync } from "node:fs";
const { page, browser } = await attach(); const links = JSON.parse(readFileSync("indlinks.json","utf8"));
for (const [name, href] of links) { await page.goto(BASE + href); await page.waitForLoadState("networkidle");
 const t = await page.locator("main").innerText(); console.log(name.slice(0,40), "|", t.split("\n").filter(l => /^(Counts|Rate)/.test(l)).join(" ")); }
await browser.close(); process.exit(0);
