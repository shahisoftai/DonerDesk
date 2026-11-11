// What a page downloads: bytes and requests by kind, the biggest files, and when the map is ready.
import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("perf");
const cdp = await page.context().newCDPSession(page);
await cdp.send("Network.enable"); await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
const reqs = new Map();
cdp.on("Network.requestWillBeSent", (e) => reqs.set(e.requestId, { url: e.request.url, t0: e.timestamp }));
cdp.on("Network.responseReceived", (e) => { const r = reqs.get(e.requestId); if (r) { r.status = e.response.status; r.type = e.type; r.headers = e.response.headers; } });
cdp.on("Network.loadingFinished", (e) => { const r = reqs.get(e.requestId); if (r) { r.bytes = e.encodedDataLength; r.t1 = e.timestamp; } });
const t0 = Date.now();
await page.goto(process.argv[2], { waitUntil: "domcontentloaded" });
await page.locator('[data-map-ready="true"]').first().waitFor({ timeout: 90000 }).catch(() => console.log("map never reported ready"));
const ready = Date.now() - t0;
await page.waitForTimeout(4000);
const kind = (u) => /\/tiles\/.*pmtiles/.test(u) ? "basemap tiles" : /\/geo\//.test(u) ? "boundaries" : /maplibre|chunk|\.js(\?|$)/.test(u) ? "javascript" : /\/fonts?\/|\.pbf|glyph/.test(u) ? "map fonts" : /\.css/.test(u) ? "css" : /\.(png|jpe?g|svg|webp)/.test(u) ? "images" : /\/api\/|\/v1\//.test(u) ? "api" : "other";
const by = {}; let total = 0;
for (const r of reqs.values()) { if (!r.bytes) continue; const k = kind(r.url); by[k] ??= { n: 0, kb: 0 }; by[k].n++; by[k].kb += r.bytes / 1024; total += r.bytes; }
console.log(`map ready after ${ready} ms; ${reqs.size} requests; ${Math.round(total / 1024)} KB over the wire`);
console.table(Object.fromEntries(Object.entries(by).map(([k, v]) => [k, { requests: v.n, KB: Math.round(v.kb) }])));
const big = [...reqs.values()].filter((r) => r.bytes).sort((a, b) => b.bytes - a.bytes).slice(0, 8);
for (const r of big) console.log(`${Math.round(r.bytes / 1024)} KB\t${Math.round((r.t1 - r.t0) * 1000)} ms\t${r.url.replace("https://donordesk.online", "").slice(0, 110)}`);
const mem = await page.evaluate(() => performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null);
console.log("JS heap MB:", mem);
await browser.close(); process.exit(0);
