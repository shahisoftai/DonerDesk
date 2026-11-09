import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("dl");
await page.goto(BASE + "/dashboards?project=14d6f13d-34ee-47ef-9d64-d16595e3e690", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(4000);
console.log(await page.evaluate(() => [...document.querySelectorAll("main a")].map(a => a.getAttribute("href") + " :: " + a.innerText.trim().slice(0,60)).filter(x=>/dashboards\//.test(x)).join("\n")));
await browser.close(); process.exit(0);
