import { attach, BASE } from "../demo-ui/lib.mjs";
const S = "/tmp/claude-1000/-home-najeeb-Linux-Dev-Humanetarian-DonerDesk/5b9cec18-2a09-4c38-858b-78c68c0eb2a3/scratchpad";
const { page, browser } = await attach("map2");
await page.goto(BASE + "/visuals/maps/cd291c72-ebc9-4f16-8633-b7c9007507ed", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(10000);
console.log("URL", new URL(page.url()).pathname, "canvas", await page.locator("canvas").count());
const t = (await page.locator("main").innerText()).replace(/\n+/g," / "); console.log(t.slice(0,2200));
console.log("CONTROLS:", await page.locator("main select:visible, main button:visible, main [role=tab]:visible").evaluateAll(s=>[...new Set(s.map(x=>(x.tagName==="SELECT"?"[select]"+(x.getAttribute("aria-label")||"")+":"+[...x.options].slice(0,4).map(o=>o.text).join("/"):x.innerText.trim().replace(/\n/g," "))))].slice(0,60)));
await page.screenshot({ path: S + "/map2.png" });
await browser.close(); process.exit(0);
