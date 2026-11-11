import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("fullview");
const done = page.getByRole("button", { name: "Done editing" }); if (await done.count()) await done.click();
await page.waitForTimeout(3000);
// Scroll through once so every chart is drawn (charts draw when seen), then back to the top.
for (let y = 0; y < 3000; y += 400) { await page.mouse.wheel(0, 400); await page.waitForTimeout(400); }
await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(2500);
const cdp = await page.context().newCDPSession(page);
const shot = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
(await import("node:fs")).writeFileSync(process.argv[2] ?? "/tmp/claude-1000/canvas3.png", Buffer.from(shot.data, "base64"));
await browser.close(); process.exit(0);
