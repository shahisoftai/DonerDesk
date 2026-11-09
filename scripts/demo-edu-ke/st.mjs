import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("st");
await page.getByRole("link", { name: "Answer now" }).first().click().catch(()=>page.getByRole("button", { name: "Answer now" }).first().click()); await page.waitForTimeout(3500);
console.log(page.url());
console.log(await page.evaluate(() => [...document.querySelectorAll("main textarea,main input")].map(e=>(e.name||e.id)+":"+e.type+":"+(document.querySelector(`label[for="${e.id}"]`)?.innerText||e.getAttribute("aria-label")||"").slice(0,90)).join("\n")));
await browser.close(); process.exit(0);
