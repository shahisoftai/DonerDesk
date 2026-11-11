import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("view");
const done = page.getByRole("button", { name: "Done editing" }); if (await done.count()) await done.click();
await page.waitForTimeout(8000);
const cdp = await page.context().newCDPSession(page);
const shot = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
(await import("node:fs")).writeFileSync(process.argv[2] ?? "/tmp/claude-1000/canvas2.png", Buffer.from(shot.data, "base64"));
await browser.close(); process.exit(0);
