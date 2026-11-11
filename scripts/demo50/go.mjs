// Opens a page in the shared visible browser and saves a screenshot: node go.mjs <path> [shot]
import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("go");
await page.goto(BASE + process.argv[2], { waitUntil: "domcontentloaded" });
await page.waitForTimeout(Number(process.env.WAIT ?? 4000));
const out = process.argv[3] ?? "/tmp/claude-1000/shot.png";
await import("node:fs").then((fs) => { try { fs.unlinkSync(out); } catch {} });
const cdp = await page.context().newCDPSession(page);
const shot = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: process.env.FULL === "1" });
(await import("node:fs")).writeFileSync(out, Buffer.from(shot.data, "base64"));
console.log(page.url());
await browser.close(); process.exit(0);
