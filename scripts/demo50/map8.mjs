import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("map8");
await page.goto(BASE + "/settings/places", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(6000);
await page.getByPlaceholder("Search places").fill("ZZ TEST"); await page.waitForTimeout(2000);
const t = await page.locator("main").innerText(); const i = t.indexOf("places\n"); console.log(t.replace(/\n+/g," / ").match(/\d+ of \d+ places[^]{0,300}/)?.[0]);
await browser.close(); process.exit(0);
