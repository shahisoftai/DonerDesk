import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("bp7"); page.setDefaultTimeout(12000);
await page.locator("summary", { hasText: "By place" }).first().click(); await page.waitForTimeout(800);
console.log(await page.evaluate(() => { const t=document.querySelector("table[aria-label^='By place']"); return t? t.innerText.replace(/\n+/g," | ").slice(0,500)+" ## "+[...t.querySelectorAll("input")].map(i=>i.getAttribute("aria-label")).slice(0,12).join(";"):"no table"; }));
await browser.close(); process.exit(0);
