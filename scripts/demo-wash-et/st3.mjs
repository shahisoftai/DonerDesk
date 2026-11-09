import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("st3");
console.log(await page.locator("main textarea").evaluateAll(a=>a.map(x=>x.value.length)));
await browser.close(); process.exit(0);
