import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("dl");
await page.goto(BASE + "/dashboards?project=cd291c72-ebc9-4f16-8633-b7c9007507ed", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(4000);
console.log(await page.evaluate(() => [...document.querySelectorAll("main a")].map(a => a.getAttribute("href") + " :: " + a.innerText.trim().slice(0,60)).filter(x=>/dashboards\//.test(x)).join("\n")));
await browser.close(); process.exit(0);
