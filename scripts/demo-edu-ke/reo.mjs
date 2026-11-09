import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("reo"); page.setDefaultTimeout(15000);
await page.getByRole("button", { name: /^Reopen for correction/ }).click(); await page.waitForTimeout(3500);
console.log(page.url());
console.log(await page.evaluate(() => [...document.querySelectorAll("main a, main button")].map(b=>b.innerText.trim()).filter(x=>x&&x.length<40).slice(0,40).join(" | ")));
await browser.close(); process.exit(0);
