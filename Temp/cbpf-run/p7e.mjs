import { attach } from "./lib.mjs";
const { page, browser, shot } = await attach("x");
console.log(await page.evaluate(()=>[innerWidth,innerHeight]));
console.log(await page.locator("aside").count(), (await page.locator("aside").allInnerTexts()).map(s=>s.slice(0,80)));
await page.mouse.wheel(0, 3000); await page.waitForTimeout(400);
await shot("results-bottom");
await browser.close();
