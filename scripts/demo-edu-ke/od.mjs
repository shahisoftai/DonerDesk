import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("od");
console.log(await page.evaluate(() => [...document.querySelectorAll("a")].filter(a=>/Open it/.test(a.innerText)).map(a=>a.href)));
await page.goto(BASE + "/dashboards", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(4000);
console.log(await page.evaluate(() => [...document.querySelectorAll("a")].map(a => a.getAttribute("href") + " :: " + a.innerText.trim().slice(0,60)).filter(x=>/dashboards\/|visuals/.test(x)).join("\n")));
await browser.close(); process.exit(0);
