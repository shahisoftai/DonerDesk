import { attach, BASE } from "./lib.mjs";
const { browser } = await attach(); const [tok, name, pw] = process.argv.slice(2);
const ctx = await browser.newContext(); const page = await ctx.newPage();
await page.goto(`${BASE}/invite/accept?token=${tok}`); await page.waitForLoadState("networkidle");
await page.getByLabel("Full name").fill(name); await page.getByLabel("Password").fill(pw);
await page.getByRole("button", { name: "Accept invitation" }).click(); await page.waitForTimeout(5000);
console.log(page.url()); console.log((await page.locator("body").innerText()).slice(0,500));
await ctx.close(); await browser.close(); process.exit(0);
