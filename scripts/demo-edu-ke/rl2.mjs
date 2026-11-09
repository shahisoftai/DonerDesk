import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("rl2"); page.setDefaultTimeout(15000);
const sel = page.locator("select").filter({ hasText: "Choose a planned activity" }).first(); const o = (await sel.locator("option").allTextContents()).find(x=>x.startsWith("Deliver radio")); console.log(o);
await sel.selectOption({ label: o }); await page.waitForTimeout(3000);
console.log(await page.evaluate(() => [...document.querySelectorAll("main button")].map(b=>b.innerText.trim()+(b.disabled?"[x]":"")).filter(x=>/Link|Save|Resubmit/.test(x))));
console.log((await page.locator("main").innerText()).match(/Planned activity it delivers[^\n]*\n[^\n]*/)?.[0]);
await browser.close(); process.exit(0);
