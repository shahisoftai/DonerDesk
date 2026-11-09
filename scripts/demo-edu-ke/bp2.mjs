import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("bp2"); page.setDefaultTimeout(12000);
await page.getByRole("button", { name: /^Reopen verified/ }).click(); await page.waitForTimeout(1500);
console.log(await page.evaluate(() => [...document.querySelectorAll("textarea, input:not([type=checkbox])")].filter(e=>e.offsetParent).map(e=>(e.getAttribute("aria-label")||e.placeholder||e.id||e.type)).slice(-5)));
console.log(await page.evaluate(() => [...document.querySelectorAll("button")].map(b=>b.innerText.trim()).filter(x=>/reopen|send|confirm|cancel/i.test(x))));
await browser.close(); process.exit(0);
