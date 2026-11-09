import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("budget");
const want = ["Rehabilitate boreholes and hand pumps - Gode and Mustahil","Train water point management committees and mechanics","Construct household and communal latrines - Gode and Dolo Ado","Rehabilitate WASH facilities in schools and health centres","Distribute hygiene and menstrual hygiene kits","A cost of the whole project","A cost of the whole project"];
const sel = page.locator("main select");
console.log("selects", await sel.count());
for (const [i, l] of want.entries()) { await sel.nth(i).selectOption({ label: l }); await page.waitForTimeout(2200); }
await browser.close(); process.exit(0);
