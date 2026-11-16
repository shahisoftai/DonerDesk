import { attach } from "../lib.mjs";
const { page, shot, browser } = await attach("fm2");
page.setDefaultTimeout(20000);
await page.getByRole("button", { name: /Add a question/ }).first().click(); await page.waitForTimeout(800);
await page.getByRole("button", { name: /Add an indicator/ }).first().click(); await page.waitForTimeout(800);
const r = await page.locator("main").evaluate(() => [...document.querySelectorAll("main label, main select, main input, main textarea, main button")].map(e => e.tagName + ":" + (e.getAttribute("aria-label") || e.innerText || e.name || e.type || "").slice(0, 50).replace(/\n/g, " ") + (e.tagName === "SELECT" ? " [" + [...e.options].map(o => o.text.slice(0, 25)).slice(0, 14).join("|") + "]" : "")));
console.log(r.filter(x => !/^BUTTON:(Remove|)$/.test(x)).join("\n"));
await shot("fm2"); await browser.close();
