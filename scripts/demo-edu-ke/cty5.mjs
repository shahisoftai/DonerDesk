import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("cty5"); page.setDefaultTimeout(20000);
await page.getByRole("button", { name: "Add place" }).first().click(); await page.waitForTimeout(3500);
const t = await page.locator("main").innerText(); console.log(t.slice(t.indexOf("Places to confirm")).slice(0,900).replace(/\n+/g," | "));
console.log(await page.evaluate(() => [...document.querySelectorAll("main input, main select")].slice(-14).map(e=>(e.getAttribute("aria-label")||e.id||e.name||e.tagName)+"="+e.value.slice(0,25))));
await browser.close(); process.exit(0);
