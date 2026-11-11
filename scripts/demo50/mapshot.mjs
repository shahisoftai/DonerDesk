import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("mapshot");
if (process.env.SAVE) { await page.getByRole("button", { name: "Save", exact: true }).click(); await page.waitForTimeout(4000); }
const map = page.locator('section[aria-label="Where we work"]').first();
await map.scrollIntoViewIfNeeded(); await page.waitForTimeout(5000);
const cards = await page.locator("section[data-card]").evaluateAll((els) => els.map((e) => `${e.getAttribute("data-card")}${e.getAttribute("data-fixed") ? "*" : ""}`));
console.log("cards:", cards.join(", "));
await map.screenshot({ path: process.argv[2] ?? "/tmp/claude-1000/map.png", timeout: 60000 });
await browser.close(); process.exit(0);
