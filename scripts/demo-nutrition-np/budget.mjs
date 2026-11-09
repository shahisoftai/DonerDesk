import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("budget");
const want = ["Establish and support OTP sites","Monthly MUAC screening campaign - Jumla","IMAM guideline training for health workers","Individual IYCF counselling at facilities and home visits","Micronutrient powder and iron-folic acid distribution","Radio programmes and community dialogues","A cost of the whole project","A cost of the whole project"];
const sel = page.locator("main select");
console.log("selects", await sel.count());
for (const [i, l] of want.entries()) { await sel.nth(i).selectOption({ label: l }); await page.waitForTimeout(2200); }
await browser.close(); process.exit(0);
