import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("bp"); page.setDefaultTimeout(12000);
await page.waitForTimeout(3000);
console.log(await page.evaluate(() => [...document.querySelectorAll("main button")].map(b=>b.innerText.trim()).filter(x=>x&&x.length<40).slice(0,40).join(" | ")));
console.log("summaries", await page.locator("summary").allInnerTexts().then(a=>[...new Set(a)].slice(0,8)));
await browser.close(); process.exit(0);
