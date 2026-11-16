import { attach } from "../lib.mjs";
const { page, shot, browser } = await attach("imp2");
page.setDefaultTimeout(30000);
const D = new URL("../inputs/", import.meta.url).pathname;
await page.locator("input[type=file]").first().setInputFiles(D + "workplan.csv"); await page.waitForTimeout(3000);
const t = await page.locator("main").innerText(); const i = t.indexOf("Or paste"); console.log(t.slice(i, i + 2500));
console.log(await page.getByRole("button").allInnerTexts().then(a => a.filter(x => /check|preview|create|import/i.test(x))));
await shot("imp2"); await browser.close();
