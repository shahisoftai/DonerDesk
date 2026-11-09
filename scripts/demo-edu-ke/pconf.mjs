import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("pconf"); page.setDefaultTimeout(20000);
console.log(await page.evaluate(() => [...document.querySelectorAll("section[aria-labelledby=import-title] button")].map(b=>b.innerText.trim())));
const b = page.locator("section[aria-labelledby=import-title] button").filter({ hasText: /^Add these places/ }); if (await b.count()) { await b.first().click(); await page.waitForTimeout(8000); }
const t = await page.locator("section[aria-labelledby=import-title]").innerText(); console.log(t.slice(-500).replace(/\n+/g," | "));
await browser.close(); process.exit(0);
