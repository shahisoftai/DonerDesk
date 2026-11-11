import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("find");
const re = new RegExp(process.argv[2], "i");
const out = await page.evaluate((src) => { const re = new RegExp(src, "i"); return [...document.querySelectorAll("a,button,summary,[role=button],label")].map((e) => `${e.tagName}:${(e.textContent||"").trim().slice(0,80)}${e.getAttribute("href")?" -> "+e.getAttribute("href"):""}`).filter((t) => re.test(t)); }, process.argv[2]);
console.log(out.join("\n"));
await browser.close(); process.exit(0);
