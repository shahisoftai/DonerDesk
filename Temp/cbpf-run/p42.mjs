import { attach } from "./lib.mjs";
const { page, browser, shot } = await attach("launch-peek2");
const t = await page.locator("section[aria-roledescription='slide']").innerText();
console.log(t.slice(t.indexOf("Sign off")).replace(/\n+/g," | ").slice(0,1500));
console.log(await page.locator("[role=alert],[role=status]").allInnerTexts());
await page.mouse.wheel(0, 4000); await page.waitForTimeout(300); await shot("launch-bottom");
await browser.close();
