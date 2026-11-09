import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("bp5"); page.setDefaultTimeout(12000);
await page.getByRole("button", { name: "Sheet", exact: true }).click(); await page.waitForTimeout(2500);
console.log(await page.evaluate(() => [...document.querySelectorAll("[role=gridcell], [role=grid] *")].slice(0,5).map(e=>e.tagName+":"+(e.getAttribute("aria-label")||e.className.slice(0,30)))));
const cell = page.locator("[role=gridcell]").filter({ hasText: "OP1-1a" }).first(); console.log(await cell.count());
const any = page.locator("[role=gridcell], td").filter({ hasText: /^300$/ }).first(); console.log("300 cell", await any.count());
await any.click().catch(()=>{}); await page.waitForTimeout(1500);
console.log(await page.locator("section[aria-label*='OP1-1a']").count(), await page.locator("summary").allInnerTexts().then(a=>[...new Set(a)]));
await browser.close(); process.exit(0);
