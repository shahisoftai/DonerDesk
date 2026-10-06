import { attach, BASE, dump } from "./lib.mjs"; import { writeFileSync } from "node:fs";
const { page, browser } = await attach();
await page.goto(BASE + "/projects/new"); await page.waitForLoadState("networkidle"); await page.waitForTimeout(1000);
console.log((await page.locator("main").innerText()).slice(0,800)); console.log((await dump(page)).join("\n"));
await browser.close(); process.exit(0);
