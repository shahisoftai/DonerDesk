// Drags a card on the map (edit mode) by dx, dy pixels, as a person would with the mouse.
import { attach } from "../demo-ui/lib.mjs";
const [key, dx, dy] = [process.argv[2], Number(process.argv[3]), Number(process.argv[4])];
const { page, browser } = await attach("dragcard");
const card = page.locator(`section[data-card="${key}"]`).first();
await card.scrollIntoViewIfNeeded();
const b = await card.boundingBox();
const sx = b.x + b.width / 2, sy = b.y + 8;
await page.mouse.move(sx, sy); await page.mouse.down();
for (let i = 1; i <= 10; i++) { await page.mouse.move(sx + (dx * i) / 10, sy + (dy * i) / 10); await page.waitForTimeout(30); }
await page.mouse.up();
await page.waitForTimeout(2500);
const a = await card.boundingBox();
console.log(key, "moved from", Math.round(b.x), Math.round(b.y), "to", Math.round(a.x), Math.round(a.y), "fixed:", await card.getAttribute("data-fixed"));
await browser.close(); process.exit(0);
