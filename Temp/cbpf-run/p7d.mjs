import { attach } from "./lib.mjs";
const { page, browser, shot } = await attach("x");
const t = await page.locator("body").innerText();
console.log(t.match(/Still to answer[\s\S]{0,900}/)?.[0] ?? "no still-to-answer text");
await browser.close();
