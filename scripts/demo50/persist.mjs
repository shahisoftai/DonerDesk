import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("persist");
await page.getByRole("button", { name: "Save", exact: true }).click();
await page.waitForTimeout(4000);
const geom = () => page.evaluate(() => { const f = document.querySelector('[data-testid="map-callouts"]').parentElement.getBoundingClientRect(); const e = document.querySelector('section[data-card="doti"]'); const b = e.getBoundingClientRect(); return `x=${Math.round(b.x - f.x)} y=${Math.round(b.y - f.y)} fixed=${e.getAttribute("data-fixed")}`; });
console.log("after save:", await geom());
await page.reload({ waitUntil: "domcontentloaded" }); await page.locator("section[data-card=doti]").waitFor({ timeout: 40000 });
console.log("after reload:", await geom());
await browser.close(); process.exit(0);
