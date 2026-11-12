import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("off2");
await page.goto(BASE + "/field", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(4500);
await page.locator("select").filter({ has: page.locator("option", { hasText: "Choose a project" }) }).first().selectOption({ index: 1 }); await page.waitForTimeout(1500);
await page.getByRole("button", { name: "See the map's size" }).click(); await page.waitForTimeout(9000);
let t = (await page.locator("body").innerText()).replace(/\n+/g," / "); let i=t.indexOf("Map for offline use"); console.log("SIZE:", t.slice(i, i+400));
const keep = page.getByRole("button", { name: /Keep the map on this phone/ });
if (await keep.count() && await keep.isEnabled()) { await keep.click(); await page.waitForTimeout(25000); t = (await page.locator("body").innerText()).replace(/\n+/g," / "); i=t.indexOf("Map for offline use"); console.log("AFTER KEEP:", t.slice(i, i+400)); }
const cache = await page.evaluate(async () => (await caches.keys()).filter(k=>/offline-maps/.test(k)));
console.log("caches:", cache);
await browser.close(); process.exit(0);
