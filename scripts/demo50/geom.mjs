import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("geom");
const r = await page.evaluate(() => { const f = document.querySelector('[data-testid="map-callouts"]').parentElement.getBoundingClientRect(); return { frame: [Math.round(f.width), Math.round(f.height)], cards: [...document.querySelectorAll("section[data-card]")].map((e) => { const b = e.getBoundingClientRect(); return `${e.getAttribute("data-card")}${e.getAttribute("data-fixed") ? "*" : ""} x=${Math.round(b.x - f.x)} y=${Math.round(b.y - f.y)} ${Math.round(b.width)}x${Math.round(b.height)}`; }) }; });
console.log(JSON.stringify(r.frame)); console.log(r.cards.join("\n"));
await browser.close(); process.exit(0);
