import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("mapshot2");
const map = page.locator('section[aria-label="Where we work"]').first();
await map.scrollIntoViewIfNeeded(); await page.waitForTimeout(4000);
const b = await map.boundingBox();
const cdp = await page.context().newCDPSession(page);
const shot = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: b.x, y: b.y + (await page.evaluate(() => window.scrollY)), width: b.width, height: b.height, scale: 1 } });
(await import("node:fs")).writeFileSync(process.argv[2] ?? "/tmp/claude-1000/map3.png", Buffer.from(shot.data, "base64"));
await browser.close(); process.exit(0);
