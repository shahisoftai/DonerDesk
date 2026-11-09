import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("scr");
await page.getByText("Other places", { exact: false }).first().scrollIntoViewIfNeeded(); await page.waitForTimeout(500);
await page.evaluate(()=>window.scrollBy(0,250)); await page.screenshot({path:process.env.SHOT});
await browser.close(); process.exit(0);
