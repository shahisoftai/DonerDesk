import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("rk2");
const s = page.locator("main select"); const set = { 1:"High", 3:"Medium", 5:"Medium", 7:"Low", 13:"Low", 15:"Low" };
for (const [i,l] of Object.entries(set)) { await s.nth(Number(i)).selectOption({ label: l }); await page.waitForTimeout(1200); }
await page.getByRole("button", { name: /^Confirm all/ }).first().click().catch(()=>{}); await page.waitForTimeout(4000);
const t = await page.locator("main").innerText(); console.log(t.match(/Still to answer \(\d+\)[\s\S]{0,400}/)?.[0]);
console.log(t.split("Risks and assumptions")[1]?.slice(-1800));
await browser.close(); process.exit(0);
