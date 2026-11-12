// Sets the map block's "Drawn on" in the editor (Build tab), saves, and captures the page so each ground can be compared.
import { attach } from "../demo-ui/lib.mjs";
const label = process.argv[2];       // e.g. "Nothing: boundaries only (fastest)"
const out = process.argv[3];
const { page, browser } = await attach("groundtest");
if (!(await page.locator("#edit-drawer-shell").count())) await page.getByRole("button", { name: "Edit", exact: true }).first().click();
await page.waitForTimeout(1500);
const map = page.locator('[data-kind="MAP"]').first(); await map.focus(); await map.press("Enter");
const edit = page.locator("#edit-drawer-shell");
await edit.locator('button[data-tab="BUILD"]').click();
await edit.getByLabel("Drawn on").selectOption({ label });
await page.waitForTimeout(500);
await page.getByRole("button", { name: "Save", exact: true }).click(); await page.waitForTimeout(3000);
const done = page.getByRole("button", { name: "Done editing" }); if (await done.count()) await done.click();
await page.waitForTimeout(12000);
const info = await page.evaluate(() => ({ ready: document.querySelector("[data-map-ready]")?.getAttribute("data-map-ready"), ground: [...document.querySelectorAll("canvas.maplibregl-canvas")].length }));
const cdp = await page.context().newCDPSession(page);
const shot = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
(await import("node:fs")).writeFileSync(out, Buffer.from(shot.data, "base64"));
console.log(label, JSON.stringify(info));
await browser.close(); process.exit(0);
