import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("pi2"); page.setDefaultTimeout(12000);
const s = page.locator("section", { has: page.locator("#places-title") });
await s.locator("#place-search").fill("Turkana County"); await page.waitForTimeout(1800);
console.log(await s.innerText().then(t=>t.replace(/\n+/g," | ").slice(0,400)));
await s.getByRole("button", { name: /Turkana County/ }).first().click(); await page.waitForTimeout(2500);
console.log(await s.innerText().then(t=>t.replace(/\n+/g," | ").slice(0,400)));
await browser.close(); process.exit(0);
