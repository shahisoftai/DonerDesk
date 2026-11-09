import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("actl");
await page.getByRole("link", { name: "Completed activities" }).first().click().catch(()=>{}); await page.waitForTimeout(3500);
console.log(page.url());
console.log(await page.evaluate(() => [...document.querySelectorAll("main a")].map(a=>a.innerText.trim().slice(0,50)+" -> "+a.getAttribute("href")).filter(x=>/activities\//.test(x)).slice(0,4)));
await browser.close(); process.exit(0);
