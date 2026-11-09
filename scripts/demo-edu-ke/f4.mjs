import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("f4");
await page.evaluate(()=>window.scrollTo(0,0)); const f = page.locator("main").getByText("fchv.csv").first(); await f.scrollIntoViewIfNeeded().catch(()=>{});
await page.screenshot({path:process.env.SHOT});
console.log(await page.evaluate(()=>[...document.querySelectorAll("main button")].map(b=>(b.innerText||b.textContent||"").trim().slice(0,30)).join("|")));
await browser.close(); process.exit(0);
