import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("btns");
console.log(await page.evaluate(() => [...document.querySelectorAll("main button")].map((b) => b.innerText.trim()).filter((t) => t && t.length < 40).slice(0, 40)));
await browser.close(); process.exit(0);
