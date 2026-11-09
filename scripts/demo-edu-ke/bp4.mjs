import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("bp4"); page.setDefaultTimeout(12000);
await page.getByLabel("Why the values are being reopened").fill("Adding the by-county breakdown of each figure."); await page.getByRole("button", { name: "Reopen", exact: true }).click(); await page.waitForTimeout(6000);
console.log((await page.locator("main").innerText()).match(/[^\n]*(reopened|Reopened|correction)[^\n]*/g)?.slice(0,3));
// open the detail of the OP1-1a row
const row = page.locator("tr, [role=row]").filter({ hasText: "OP1-1a" }).first(); await row.click(); await page.waitForTimeout(1500);
console.log("summaries", await page.locator("summary").allInnerTexts().then(a=>[...new Set(a)]));
await browser.close(); process.exit(0);
