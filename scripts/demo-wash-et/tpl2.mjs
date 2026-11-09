import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("tpl2");
const card = page.locator("main li, main article, main div").filter({ hasText: "Nutrition: screening and treatment" }).filter({ has: page.getByRole("button", { name: "Use this template" }) }).last();
await card.getByRole("button", { name: "Use this template" }).click(); await page.waitForTimeout(3000);
console.log(await page.evaluate(() => [...document.querySelectorAll("main select")].map((s,i)=>i+": "+(s.getAttribute("aria-label")||s.name||s.id)+" => "+[...s.options].slice(0,3).map(o=>o.textContent.trim().slice(0,40)).join("/"))));
console.log((await page.locator("main").innerText()).slice(0,1800));
await page.screenshot({path:process.env.SHOT, fullPage:true});
await browser.close(); process.exit(0);
