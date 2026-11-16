import { attach } from "../lib.mjs";
const { page, shot, browser } = await attach("pl6");
page.setDefaultTimeout(15000);
const btns = await page.getByRole("button").evaluateAll(b => b.map(x => (x.getAttribute("aria-label") || x.innerText).slice(0, 40)).filter(x => x));
console.log(btns.slice(0, 60));
await shot("pl6"); await browser.close();
