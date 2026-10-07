import { attach, BASE, dump } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("dumpnew");
await page.goto(BASE + process.argv[2]); await page.waitForLoadState("networkidle"); await page.waitForTimeout(1000);
console.log((await page.locator("main").innerText()).slice(0,1200)); console.log((await dump(page)).join("\n"));
await browser.close(); process.exit(0);
