import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("placesadd");
await page.getByRole("button", { name: "Add these places" }).click();
await page.waitForTimeout(5000);
console.log((await page.locator('[role="status"],[role="alert"]').allTextContents()).join(" / ").slice(0, 300));
await browser.close(); process.exit(0);
