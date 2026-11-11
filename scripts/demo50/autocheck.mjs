import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("autocheck");
await page.goto(BASE + "/visuals/dd48f055-3b8b-4366-b0f9-756ee60db863", { waitUntil: "domcontentloaded" });
await page.locator("section[data-card=doti]").waitFor({ timeout: 40000 });
await page.waitForTimeout(3000);
const r = await page.evaluate(() => { const f = document.querySelector('[data-testid="map-callouts"]').parentElement.getBoundingClientRect(); return [...document.querySelectorAll("section[data-card]")].map((e) => { const b = e.getBoundingClientRect(); return `${e.getAttribute("data-card")}${e.getAttribute("data-fixed") ? "*" : ""} x=${Math.round(b.x - f.x)} y=${Math.round(b.y - f.y)}`; }); });
console.log(r.join("\n"));
await browser.close(); process.exit(0);
