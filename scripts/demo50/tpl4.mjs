import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("tpl4");
await page.goto(BASE + "/visuals", { waldUntil: "domcontentloaded" }).catch(()=>{}); await page.waitForTimeout(6000);
const links = await page.locator("main a").evaluateAll(a=>a.filter(x=>/ZZ TEST/.test(x.innerText)).map(x=>x.innerText.replace(/\n+/g," / ").slice(0,160)+" -> "+x.getAttribute("href")));
console.log(links);
await browser.close(); process.exit(0);
