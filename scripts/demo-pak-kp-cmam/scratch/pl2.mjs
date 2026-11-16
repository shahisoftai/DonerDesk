import { attach } from "../lib.mjs";
const { page, browser } = await attach("pl2");
const t = await page.locator("main").innerText(); const i = t.search(/Import|Upload|spreadsheet|CSV/i); console.log(i); console.log(t.slice(Math.max(0, t.length - 2500)));
const f = page.locator("input[type=file]").first(); console.log(await f.evaluate(e => [e.accept, e.closest("section,form,div[class*=card]")?.innerText.slice(0, 600)]));
await browser.close();
