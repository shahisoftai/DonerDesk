import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("theme");
await page.locator('input[type=file][aria-label="Load a theme file"]').setInputFiles(process.env.FILE);
await page.waitForTimeout(1500);
console.log("theme:", (await page.locator('[role="status"],[role="alert"]').allTextContents()).join(" / ").slice(0, 300));
await page.getByRole("button", { name: "Save", exact: true }).click();
await page.waitForTimeout(5000);
console.log("save:", (await page.locator('[role="status"],[role="alert"]').allTextContents()).join(" / ").slice(0, 300));
await browser.close(); process.exit(0);
