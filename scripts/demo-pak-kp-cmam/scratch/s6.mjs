import { attach } from "../lib.mjs";
const { page, shot, browser } = await attach("s6");
page.setDefaultTimeout(60000);
await page.getByRole("button", { name: /^6\. / }).first().click(); await page.waitForTimeout(1200);
const a = page.getByRole("button", { name: /^Accept all/ }).first(); console.log(await a.count()); if (await a.count()) { await a.click(); await page.waitForTimeout(8000); }
const t = await page.locator("main").innerText();
console.log(t.slice(t.indexOf("How complete"), t.indexOf("How complete") + 300));
const i = t.indexOf("The work plan on a timeline"); const j = t.indexOf("Add an activity"); console.log(t.slice(j - 1500, j + 600));
await shot("s6"); await browser.close();
