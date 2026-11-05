import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("dump");
const t = await page.locator("main").innerText(); const k = process.argv[2]; const i = k ? t.indexOf(k) : 0;
console.log(t.slice(i, i + Number(process.argv[3] ?? 6000))); console.log(page.url());
const link = await page.locator("a", { hasText: "Open the project" }).first().getAttribute("href").catch(() => null); console.log("LINK", link);
await browser.close(); process.exit(0);
