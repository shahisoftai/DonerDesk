import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("perf3");
const log = [];
page.on("console", (m) => { if (["error", "warning"].includes(m.type())) log.push(`${m.type()}: ${m.text().slice(0, 220)}`); });
page.on("pageerror", (e) => log.push(`pageerror: ${e.message.slice(0, 220)}`));
const t0 = Date.now();
await page.goto(process.argv[2], { waitUntil: "domcontentloaded" });
const snap = async (label) => console.log(label, Date.now() - t0, "ms", JSON.stringify(await page.evaluate(() => ({ canvases: document.querySelectorAll("canvas").length, ml: document.querySelectorAll(".maplibregl-canvas").length, ready: document.querySelector("[data-map-ready]")?.getAttribute("data-map-ready"), table: !!document.querySelector('[data-testid="map-data-table"],table'), text: document.body.innerText.includes("cannot draw maps") }))));
for (const s of [5, 10, 20, 30, 45, 60]) { await page.waitForTimeout(s === 5 ? 5000 : (s - ([5, 10, 20, 30, 45, 60][[5, 10, 20, 30, 45, 60].indexOf(s) - 1] ?? 0)) * 1000); await snap(`t+${s}s`); }
console.log(log.slice(0, 15).join("\n") || "no console errors");
await browser.close(); process.exit(0);
