import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("asg"); page.setDefaultTimeout(12000);
await page.getByRole("button", { name: "Assign member" }).first().click().catch(()=>{}); await page.waitForTimeout(1500);
console.log(await page.evaluate(() => [...document.querySelectorAll("main select")].map(s=>(s.getAttribute("aria-label")||s.id)+": "+[...s.options].map(o=>o.text.slice(0,40)).join(" , ")).slice(0,4)));
await browser.close(); process.exit(0);
