import { attach } from "../lib.mjs";
const { page, shot, browser } = await attach("tm2");
page.setDefaultTimeout(15000);
await page.getByRole("button", { name: "Invite member" }).click(); await page.waitForTimeout(1500);
const r = await page.locator("[role=dialog], main").last().evaluate(el => [...el.querySelectorAll("label, select, input, button, textarea")].map(e => e.tagName + ":" + (e.getAttribute("aria-label") || e.innerText || e.name || e.type).slice(0, 50).replace(/\n/g, " ")));
console.log(r.join("\n"));
await shot("tm2"); await browser.close();
