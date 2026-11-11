import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("embedcheck");
await page.goto("https://donordesk.online/embed/canvas/8vSHMDmxiJNJG7S4YElUSj3q9Wac2fsC", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(12000);
console.log("embed:", JSON.stringify(await page.evaluate(() => ({ slicers: [...document.querySelectorAll("[data-filter]")].map((e) => e.getAttribute("data-filter")), cards: document.querySelectorAll("section[data-card]").length, figure: document.querySelectorAll('[data-testid="multi-card"]').length }))));
await browser.close(); process.exit(0);
