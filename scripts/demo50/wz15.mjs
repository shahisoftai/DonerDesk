import { open, shot } from "./wz.mjs";
const { page, browser } = await open("wz15");
await page.getByRole("button", { name: /^4\. / }).click(); await page.waitForTimeout(2500);
const h = page.getByText("WASH-Q-01", { exact: true }).first(); await h.scrollIntoViewIfNeeded(); await page.waitForTimeout(500);
await page.screenshot({ path: "/tmp/claude-1000/-home-najeeb-Linux-Dev-Humanetarian-DonerDesk/5b9cec18-2a09-4c38-858b-78c68c0eb2a3/scratchpad/wz15.png" });
await browser.close(); process.exit(0);
