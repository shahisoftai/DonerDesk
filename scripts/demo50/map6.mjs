import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("map6");
await page.goto(BASE + "/settings/places", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(6000);
const form = page.locator("div, section", { has: page.getByRole("button", { name: "Add place" }).first() }).filter({ hasText: "What is it?" }).last();
console.log("ADD FORM:", (await form.innerText()).replace(/\n+/g," / ").slice(0,500));
console.log("FIELDS:", await form.locator("input:visible, select:visible, textarea:visible").evaluateAll(s=>s.map(x=>[x.tagName,x.type,x.getAttribute("aria-label")||x.placeholder||(x.closest("label")?.innerText||"").slice(0,25)])));
await browser.close(); process.exit(0);
