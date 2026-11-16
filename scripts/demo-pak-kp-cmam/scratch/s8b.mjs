import { attach } from "../lib.mjs";
const { page, browser } = await attach("s8b");
page.setDefaultTimeout(15000);
await page.getByLabel("Layout", { exact: true }).last().selectOption({ label: "The standard layout" });
const due = page.getByLabel("Due (days after the period ends)", { exact: true }).last(); await due.fill("30"); await due.press("Tab"); await page.waitForTimeout(800);
await page.getByRole("button", { name: /^9\. / }).first().click(); await page.waitForTimeout(1200);
const t = await page.locator("main").innerText(); console.log(t.slice(t.indexOf("9 / 10"), t.indexOf("9 / 10") + 1800)); console.log(t.slice(t.indexOf("Still to answer")).slice(0, 300));
await browser.close();
