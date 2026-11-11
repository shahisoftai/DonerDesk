import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("linkview");
const url = "https://donordesk.online/shared/canvas/8vSHMDmxiJNJG7S4YElUSj3q9Wac2fsC" + (process.argv[2] ?? "");
await page.goto(url, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(12000);
const r = await page.evaluate(() => ({
  filters: !!document.querySelector('[data-testid="canvas-filters"]'),
  slicers: [...document.querySelectorAll("[data-filter]")].map((e) => e.getAttribute("data-filter")),
  cards: [...document.querySelectorAll("section[data-card]")].map((e) => e.getAttribute("data-card")),
  figureCards: [...document.querySelectorAll('[data-testid="multi-card"]')].map((c) => c.innerText.replace(/\s+/g, " ").slice(0, 120)),
  title: document.querySelector("h1")?.textContent,
}));
console.log(JSON.stringify(r, null, 1));
await browser.close(); process.exit(0);
