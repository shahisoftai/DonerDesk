import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("dl");
await page.goto(BASE + "/dashboards?project=8e20556a-115e-48a7-be9b-bb1bfe14bf70", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(4000);
console.log(await page.evaluate(() => [...document.querySelectorAll("main a")].map(a => a.getAttribute("href") + " :: " + a.innerText.trim().slice(0,60)).filter(x=>/dashboards\//.test(x)).join("\n")));
await browser.close(); process.exit(0);
