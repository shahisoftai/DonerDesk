import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("budget");
const want = ["Monthly cash and food distribution - Maiduguri", "Community MUAC screening - Monguno and Bama", "Distribute dry-season seed and tool kits", "Form and train VSLA groups", "Cash-for-work: rehabilitate farm roads and irrigation channels", "A cost of the whole project", "A cost of the whole project"];
const sel = page.locator("main select");
console.log("selects", await sel.count());
for (const [i, l] of want.entries()) { await sel.nth(i).selectOption({ label: l }); await page.waitForTimeout(800); }
await browser.close(); process.exit(0);
