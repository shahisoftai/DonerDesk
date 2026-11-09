import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("budget");
const want = ["Construct and rehabilitate classrooms and school WASH facilities - Turkana and Marsabit","Establish and run accelerated education centres - Turkana and Garissa","Train teachers in competency-based and inclusive teaching","Run remedial reading and numeracy clubs","Provide bursaries and dignity kits to girls","A cost of the whole project","A cost of the whole project"];
const sel = page.locator("main select");
console.log("selects", await sel.count());
for (const [i, l] of want.entries()) { await sel.nth(i).selectOption({ label: l }); await page.waitForTimeout(2200); }
await browser.close(); process.exit(0);
