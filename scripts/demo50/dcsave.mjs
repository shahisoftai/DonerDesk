import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("dcsave");
await page.getByRole("button", { name: /^Save \d+ changes?$/ }).click();
await page.waitForTimeout(8000);
console.log((await page.locator('[role="status"],[role="alert"]').allTextContents()).join(" / ").slice(0, 400));
await browser.close(); process.exit(0);
