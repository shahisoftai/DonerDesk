import { attach } from "./lib.mjs";
const { page, browser, shot, step } = await attach("workplan");
const slide = page.locator("section[aria-roledescription='slide']");
const card = slide.locator("article").first();
console.log("extracted:", await card.locator("input").evaluateAll(i=>i.map(x=>x.type+":"+x.value)), await card.locator("select").evaluateAll(s=>s.map(x=>x.selectedOptions[0]?.textContent)));
await browser.close();
