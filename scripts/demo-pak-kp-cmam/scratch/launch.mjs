import { attach } from "../lib.mjs";
const { page, shot, browser } = await attach("launch");
page.setDefaultTimeout(30000);
await page.getByRole("button", { name: "Sign off", exact: true }).click(); await page.waitForTimeout(3000);
await page.getByRole("button", { name: "Start the project", exact: true }).click();
for (let i = 0; i < 60; i++) { await page.waitForTimeout(5000); const t = await page.locator("main").innerText(); if (/The project has been started|could not|failed|stopped/i.test(t)) break; }
await shot("launched"); const t = await page.locator("main").innerText(); console.log(page.url()); console.log(t.slice(t.indexOf("Start the project")).slice(0, 1800));
console.log(await page.getByRole("link").evaluateAll(a => a.filter(x => /open the project/i.test(x.innerText)).map(x => x.href)));
await browser.close();
