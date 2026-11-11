import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("anchors");
const r = await page.evaluate(() => [...document.querySelectorAll("section[data-card]")].map((e) => { const line = [...document.querySelectorAll('[data-testid="map-callouts"] svg line')]; return null; }));
const lines = await page.evaluate(() => [...document.querySelectorAll('[data-testid="map-callouts"] svg g')].map((g) => { const l = g.querySelector("line"), c = g.querySelector("circle"); return `${Math.round(+c.getAttribute("cx"))},${Math.round(+c.getAttribute("cy"))}`; }));
console.log("anchor dots (px):", lines.join(" | "));
await browser.close(); process.exit(0);
