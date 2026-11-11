import { chromium } from "../demo-ui/lib.mjs";
const browser = await chromium.connectOverCDP("http://localhost:9360");
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page = await ctx.newPage();
await page.goto(process.argv[2], { waitUntil: "domcontentloaded" });
await page.locator('[data-map-ready="true"]').first().waitFor({ timeout: 90000 }).catch(() => {});
await page.waitForTimeout(2000);
const out = await page.evaluate(async () => {
  const files = performance.getEntriesByType("resource").filter((e) => /\.js(\?|$)/.test(e.name));
  const sig = { echarts: /echarts|zrender/i, maplibre: /maplibre|mapbox-gl/i, "pmtiles/protomaps": /pmtiles|protomaps/i, "country list": /Afghanistan/, gazetteer: /gazetteer|Nuuk|Qaanaaq/i, tiptap: /tiptap|prosemirror/i, "zod": /ZodError|ZodType/, "xlsx": /xlsx|SheetJS/i, recharts: /recharts/i, "terra-draw": /terra-draw|TerraDraw/i, "html-to-image": /html-to-image/i };
  const rows = [];
  for (const f of files) { let t = ""; try { t = await (await fetch(f.name)).text(); } catch {} const tags = Object.entries(sig).filter(([, re]) => re.test(t)).map(([k]) => k); rows.push({ file: f.name.split("/").pop().slice(0, 28), kb: Math.round(t.length / 1024), tags: tags.join(",") }); }
  return rows.sort((a, b) => b.kb - a.kb);
});
let total = 0; for (const r of out) total += r.kb;
console.log("total decoded JS KB:", total, "in", out.length, "files");
for (const r of out.slice(0, 16)) console.log(String(r.kb).padStart(6), "KB", r.file.padEnd(30), r.tags);
await ctx.close(); await browser.close(); process.exit(0);
