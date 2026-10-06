import { attach, BASE, dump } from "./lib.mjs";
const { browser } = await attach();
const ctx = await browser.newContext(); const page = await ctx.newPage();
await page.goto(`${BASE}/invite/accept?token=${process.argv[2]}`); await page.waitForLoadState("networkidle");
console.log((await page.locator("body").innerText()).slice(0,600)); console.log((await dump(page).catch(()=>[])).join("\n"));
await page.screenshot({path:"invite.png"});
await browser.close(); process.exit(0);
