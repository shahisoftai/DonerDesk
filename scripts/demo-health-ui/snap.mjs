import { attach, BASE, dump } from "./lib.mjs";
const { page, browser } = await attach();
const u = process.argv[2]; if (u) { await page.goto(u.startsWith("http") ? u : BASE + u); await page.waitForLoadState("networkidle"); await page.waitForTimeout(1500); }
console.log(page.url());
const n = Number(process.argv[3] ?? 2500);
console.log((await page.locator("main").innerText()).slice(0, n));
if (process.argv[4] !== "nodump") console.log((await dump(page)).join("\n"));
await browser.close(); process.exit(0);
