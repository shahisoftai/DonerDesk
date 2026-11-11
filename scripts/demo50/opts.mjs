import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("opts");
for (const s of await page.locator("select").all()) console.log(JSON.stringify((await s.locator("option").allTextContents()).slice(0, 12)));
await browser.close(); process.exit(0);
