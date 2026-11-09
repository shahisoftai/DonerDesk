import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("flg7"); page.setDefaultTimeout(12000);
await page.getByText("Outcomes and Impact", { exact: true }).first().click(); await page.waitForTimeout(2500);
await page.getByRole("button", { name: "Keep with a note" }).first().click(); await page.waitForTimeout(1500);
console.log(await page.evaluate(() => [...document.querySelectorAll("textarea, input[type=text]")].filter(e=>e.offsetParent).map(e=>(e.getAttribute("aria-label")||e.placeholder||e.id)).slice(-4)));
console.log(await page.evaluate(() => [...document.querySelectorAll("button")].map(b=>b.innerText.trim()).filter(x=>/save|confirm|keep|cancel/i.test(x)).slice(0,8)));
await browser.close(); process.exit(0);
