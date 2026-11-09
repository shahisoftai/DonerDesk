import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("b2");
const sel = page.locator("main select");
console.log(await sel.evaluateAll((s) => s.map((x) => x.options[x.selectedIndex].text.slice(0, 30))));
await sel.nth(1).selectOption({ label: "Community MUAC screening - Monguno and Bama" }); await page.waitForTimeout(2000);
console.log(await sel.evaluateAll((s) => s.map((x) => x.options[x.selectedIndex].text.slice(0, 30))));
await browser.close(); process.exit(0);
