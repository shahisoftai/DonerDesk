import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("shotel");
const tile = page.locator(`section[aria-label="${process.argv[2]}"]`).first();
const vc = tile.getByRole("button", { name: "View chart" }); if (await vc.count()) await vc.click();
await tile.scrollIntoViewIfNeeded(); await page.waitForTimeout(3000);
await tile.screenshot({ path: "/tmp/claude-1000/el.png", timeout: 60000, animations: "disabled" });
await browser.close(); process.exit(0);
