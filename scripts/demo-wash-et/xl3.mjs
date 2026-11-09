import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("xl3");
console.log(await page.evaluate(() => [...document.querySelectorAll("main button")].map(b=>b.innerText.trim()).filter(Boolean).join(" | ")));
await browser.close(); process.exit(0);
