import { attach } from "../lib.mjs";
const { page, shot, browser } = await attach("mg1");
page.setDefaultTimeout(15000);
await page.getByText(/^Sites \(/).first().click(); await page.waitForTimeout(1000);
await page.getByRole("link", { name: /Khyber Pakhtunkhwa › Pakistan/ }).first().click(); await page.waitForTimeout(3000);
console.log(page.url()); const t = await page.locator("main").innerText(); console.log(t.slice(0, 1800));
console.log(await page.getByRole("button").allInnerTexts().then(a => a.filter(x => /merge|retire|combine/i.test(x))));
await shot("mg1"); await browser.close();
