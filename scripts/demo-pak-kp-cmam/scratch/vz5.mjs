import { attach } from "../lib.mjs";
const { page, shot, browser } = await attach("vz5");
const r = await page.locator("select").evaluateAll(ss => ss.map((s, i) => i + ":" + (s.getAttribute("aria-label") || s.id || s.closest("div")?.innerText.split("\n")[0]).slice(0, 40) + " => " + s.options[s.selectedIndex]?.text.slice(0, 50) + " (" + s.options.length + ")"));
console.log(r.join("\n"));
await browser.close();
