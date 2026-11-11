// The link as a stranger sees it: a brand-new browser context, no cookies, no storage, no service worker.
import { chromium } from "../demo-ui/lib.mjs";
const browser = await chromium.connectOverCDP("http://localhost:9360");
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page = await ctx.newPage();
const log = []; const t0 = Date.now();
page.on("console", (m) => { if (["error"].includes(m.type())) log.push(`console: ${m.text().slice(0, 200)}`); });
page.on("request", (r) => { if (!/_next\/static|\.pmtiles|\/geo\/|\/tiles\/|\.woff|\.png|\.svg|\.ico/.test(r.url())) log.push(`+${Math.round((Date.now() - t0) / 100) / 10}s ${r.method()} ${r.url().replace("https://donordesk.online", "").slice(0, 110)}`); });
page.on("response", (r) => { if (r.status() >= 400) log.push(`${r.status()} ${r.url().replace("https://donordesk.online", "").slice(0, 100)}`); });
page.on("framenavigated", (f) => { if (f === page.mainFrame()) log.push(`navigated: ${f.url().replace("https://donordesk.online", "").slice(0, 80)}`); });
await page.goto(process.argv[2], { waitUntil: "domcontentloaded" });
for (const s of [3, 8, 15, 30]) {
  await page.waitForTimeout(Math.max(0, s * 1000 - (Date.now() - t0)));
  console.log(`t+${s}s`, JSON.stringify(await page.evaluate(() => ({ url: location.pathname, canvases: document.querySelectorAll("canvas").length, cards: document.querySelectorAll("section[data-card]").length, slicers: document.querySelectorAll("[data-filter]").length, mapReady: document.querySelector("[data-map-ready]")?.getAttribute("data-map-ready") }))));
}
console.log(log.join("\n") || "no errors");
await ctx.close(); await browser.close(); process.exit(0);
