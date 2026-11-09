import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("btn");
console.log(await page.evaluate(() => [...document.querySelectorAll("main a, main button")].map(e=>(e.innerText||"").trim().replace(/\n/g," ").slice(0,40)+"@"+(e.getAttribute("href")||"")).filter(x=>x.length>1).join("\n")));
await browser.close(); process.exit(0);
