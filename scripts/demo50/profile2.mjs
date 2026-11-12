import { chromium } from "../demo-ui/lib.mjs";
const browser = await chromium.connectOverCDP("http://localhost:9360");
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
await cdp.send("Profiler.enable"); await cdp.send("Profiler.setSamplingInterval", { interval: 1000 });
await cdp.send("Profiler.start");
await page.goto(process.argv[2], { waitUntil: "domcontentloaded" });
await page.locator('[data-map-ready="true"]').first().waitFor({ timeout: 90000 }).catch(() => {});
await page.waitForTimeout(1500);
const { profile } = await cdp.send("Profiler.stop");
const byId = new Map(profile.nodes.map((n) => [n.id, n])); const parent = new Map();
for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
const self = new Map(); profile.samples.forEach((id, i) => self.set(id, (self.get(id) ?? 0) + (profile.timeDeltas[i] ?? 1000) / 1000));
const hot = [...self].filter(([id]) => !["(idle)", "(program)", "(garbage collector)", "(root)"].includes(byId.get(id).callFrame.functionName)).sort((a, b) => b[1] - a[1]).slice(0, 5);
const scripts = {};
for (const [id, ms] of hot) {
  const f = byId.get(id).callFrame; const url = f.url;
  scripts[url] ??= await page.evaluate((u) => fetch(u).then((r) => r.text()), url);
  const src = scripts[url].split("\n")[f.lineNumber] ?? "";
  const snippet = src.slice(Math.max(0, f.columnNumber - 10), f.columnNumber + 330).replace(/\s+/g, " ");
  console.log(`\n== ${Math.round(ms)} ms  ${f.functionName || "(anon)"}  ${url.split("/").pop()}:${f.lineNumber}:${f.columnNumber}\n   code: ${snippet}`);
  let p = parent.get(id), chain = [];
  for (let i = 0; p && i < 7; i++, p = parent.get(p)) { const c = byId.get(p).callFrame; chain.push(`${c.functionName || "(anon)"}@${c.url.split("/").pop().slice(0, 14)}`); }
  console.log("   called by:", chain.join(" < "));
}
await ctx.close(); await browser.close(); process.exit(0);
