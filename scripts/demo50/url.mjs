import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("url"); console.log(page.url(), (await page.locator('[role="alert"]').allTextContents()).join("/")); await browser.close(); process.exit(0);
