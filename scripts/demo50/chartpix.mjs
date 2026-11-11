import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("chartpix");
const r = await page.evaluate(() => [...document.querySelectorAll('section[aria-label="Meetings by province"] canvas, section[aria-label="Data sharing by province"] canvas')].map((c) => { const ctx = c.getContext("2d"); const d = ctx.getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++; return n; }));
console.log("painted pixels:", r);
await browser.close(); process.exit(0);
