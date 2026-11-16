import { attach, BASE } from "../lib.mjs";
const { page, browser } = await attach("dl");
await page.goto(BASE + "/visuals"); 
const r = await page.evaluate(async () => { const x = await fetch("/api/proxy/v1/dashboards"); return [x.status, (await x.text()).slice(0, 1500)]; });
console.log(r[0]); try { const j = JSON.parse(r[1] + (r[1].length >= 1500 ? "" : "")); console.log(j); } catch { console.log(r[1]); }
await browser.close();
