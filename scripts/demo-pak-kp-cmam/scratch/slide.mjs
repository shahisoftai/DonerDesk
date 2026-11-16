import { attach } from "../lib.mjs";
const { page, shot, browser } = await attach("slide");
const n = process.argv[2];
await page.getByRole("button", { name: new RegExp("^" + n + "\\. ") }).first().click(); await page.waitForTimeout(1500);
const t = await page.locator("main").innerText(); const i = t.indexOf(n + " / 10"); console.log(t.slice(i, i + 3500));
console.log("LABELS", await page.locator("main label, main [aria-label]").evaluateAll(els=>els.map(e=>e.getAttribute("aria-label")||e.innerText.slice(0,40)).slice(0,60)));
await shot("slide" + n); await browser.close();
