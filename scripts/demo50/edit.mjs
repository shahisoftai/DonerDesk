import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("edit");
const btn = page.getByRole("button", { name: "Edit", exact: true }).first();
if (await btn.count()) await btn.click();
await page.waitForTimeout(2500);
const cdp = await page.context().newCDPSession(page);
const shot = await cdp.send("Page.captureScreenshot", { format: "png" });
(await import("node:fs")).writeFileSync("/tmp/claude-1000/editor.png", Buffer.from(shot.data, "base64"));
await browser.close(); process.exit(0);
