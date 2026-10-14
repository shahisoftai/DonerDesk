import { attach, BASE, dump } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("look");
await page.goto(BASE + process.argv[2]); await page.waitForLoadState("networkidle"); await page.waitForTimeout(1500);
console.log((await page.locator("main").innerText()).replace(/\n+/g," | ").slice(0, Number(process.argv[3] ?? 2500)));
if (process.argv[4]) console.log((await dump(page)).join("\n"));
await browser.close(); process.exit(0);
