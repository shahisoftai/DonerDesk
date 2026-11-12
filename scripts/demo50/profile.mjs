// A CPU profile of the page while it loads and draws: self time by script and by function.
import { chromium } from "../demo-ui/lib.mjs";
const browser = await chromium.connectOverCDP("http://localhost:9360");
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
await cdp.send("Profiler.enable"); await cdp.send("Profiler.setSamplingInterval", { interval: 1000 });
await cdp.send("Profiler.start");
await page.goto(process.argv[2], { waitUntil: "domcontentloaded" });
await page.locator('[data-map-ready="true"]').first().waitFor({ timeout: 90000 }).catch(() => {});
await page.waitForTimeout(2000);
const { profile } = await cdp.send("Profiler.stop");
const byNode = new Map(profile.nodes.map((n) => [n.id, n]));
const self = new Map(); const total = profile.samples.length;
profile.samples.forEach((id, i) => { const dt = (profile.timeDeltas[i] ?? 1000) / 1000; self.set(id, (self.get(id) ?? 0) + dt); });
const byScript = {}, byFn = {};
let all = 0;
for (const [id, ms] of self) {
  const n = byNode.get(id); const f = n.callFrame; if (["(idle)", "(program)", "(garbage collector)"].includes(f.functionName)) { byScript[f.functionName] = (byScript[f.functionName] ?? 0) + ms; continue; }
  all += ms; const url = (f.url || "(native)").replace("https://donordesk.online", "").split("?")[0].slice(-40);
  byScript[url] = (byScript[url] ?? 0) + ms;
  const key = `${f.functionName || "(anon)"} @ ${url}:${f.lineNumber}`; byFn[key] = (byFn[key] ?? 0) + ms;
}
const top = (o, n) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${String(Math.round(v)).padStart(6)} ms  ${k}`).join("\n");
console.log("JS running (not idle):", Math.round(all), "ms\n--- by script / category\n" + top(byScript, 12) + "\n--- top functions\n" + top(byFn, 14));
await ctx.close(); await browser.close(); process.exit(0);
