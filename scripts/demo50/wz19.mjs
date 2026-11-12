import { open } from "./wz.mjs";
const { page, browser } = await open("wz19");
await page.getByRole("button", { name: /^4\. / }).click(); await page.waitForTimeout(2500);
const r = await page.locator("main input:visible, main select:visible").evaluateAll(s=>s.slice(-16).map(x=>[x.type, (x.closest("div")?.previousElementSibling?.innerText||"").slice(0,18), x.value]));
console.log(JSON.stringify(r));
await browser.close(); process.exit(0);
