import { attach, BASE, dump } from "./lib.mjs";
const { ctx, browser } = await attach(); const page = await ctx.newPage();
await page.goto(process.argv[2].startsWith("http") ? process.argv[2] : BASE + process.argv[2]); await page.waitForLoadState("networkidle"); await page.waitForTimeout(1500);
console.log((await page.locator("main").innerText()).slice(0, Number(process.argv[3] ?? 3000)));
console.log((await dump(page)).filter(l=>!/^a .*\/projects\/[0-9a-f-]+ \|/.test(l)).join("\n"));
await page.close(); await browser.close(); process.exit(0);
