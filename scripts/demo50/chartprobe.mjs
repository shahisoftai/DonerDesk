import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("chartprobe");
const r = await page.evaluate(() => [...document.querySelectorAll("section[aria-label]")].map((s) => { const c = s.querySelector("canvas,svg"); const b = s.getBoundingClientRect(); return `${s.getAttribute("aria-label")} | box ${Math.round(b.width)}x${Math.round(b.height)} | ${c ? c.tagName + " " + c.clientWidth + "x" + c.clientHeight : "no canvas"}`; }));
console.log(r.join("\n"));
await browser.close(); process.exit(0);
