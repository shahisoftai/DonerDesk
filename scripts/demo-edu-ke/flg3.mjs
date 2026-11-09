import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("flg3");
const t = await page.locator("body").innerText(); const i = t.indexOf("need your decision"); console.log(t.slice(Math.max(0,i-60), i+900));
await browser.close(); process.exit(0);
