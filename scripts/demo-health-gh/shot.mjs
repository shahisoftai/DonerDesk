import { attach } from "../demo-ui/lib.mjs"; const { page, browser } = await attach("shot"); await page.screenshot({ path: process.argv[2], fullPage: false }); await browser.close(); process.exit(0);
