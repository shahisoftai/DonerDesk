import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("sel");
const s = page.locator("select").filter({ hasText: "Choose a sector" }).first();
console.log(await s.evaluate(e=>e.value+"|"+e.disabled+"|"+[...e.options].slice(0,6).map(o=>o.value+"="+o.text).join(",")));
await s.selectOption({ label: "Water, sanitation and hygiene" }, {timeout:8000}); await page.waitForTimeout(2500);
console.log((await page.locator("main").innerText()).match(/(No sector|Main sector[^\n]*\n[^\n]*\n[^\n]*)/g));
await browser.close(); process.exit(0);
