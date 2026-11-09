import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("bp6"); page.setDefaultTimeout(12000);
const row = page.locator("tr").filter({ has: page.locator("[role=gridcell]", { hasText: "OP1-1a" }) }).first();
const cells = row.locator("[role=gridcell]"); console.log("cells", await cells.count());
for (let i = 0; i < Math.min(8, await cells.count()); i++) { await cells.nth(i).click().catch(()=>{}); await page.waitForTimeout(600); const n = await page.locator("section[aria-label*='OP1-1a']").count(); if (n) { console.log("detail at cell", i, await page.locator("summary").allInnerTexts().then(a=>[...new Set(a)])); break; } }
await browser.close(); process.exit(0);
