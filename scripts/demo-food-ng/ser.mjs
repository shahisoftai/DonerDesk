import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("ser");
const sel = page.locator("main select"); const L = { 0: "High", 1: "Medium", 2: "Medium", 5: "Low", 6: "Low" };
for (const [r, l] of Object.entries(L)) { await sel.nth(Number(r) * 2 + 1).selectOption({ label: l }); await page.waitForTimeout(800); }
await browser.close(); process.exit(0);
