// Visual regression for the dashboard screen (Phase 39.11): the management dashboard of the tiles harness (number tiles, a donut, KPI tiles, a note) drawn in light and dark
// at three widths, compared with stored pictures. Maps are hidden (they draw from boundary files and would make the comparison unstable). Animation is off (reduced motion).
//   pnpm --filter @donordesk/web test:visuals            compare with the stored pictures
//   pnpm --filter @donordesk/web test:visuals -- --update   store the current pictures as the new baseline (review them in the pull request)
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { build } from "../dashboard-tiles/build.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const web = resolve(here, "../../..");
const update = process.argv.includes("--update");
const baseline = join(here, "baseline");
const out = mkdtempSync(join(tmpdir(), "visuals-"));
await build(join(out, "bundle.js"));
execFileSync("npx", ["tailwindcss", "-c", "tailwind.config.ts", "-i", "src/app/globals.css", "-o", join(out, "styles.css")], { cwd: web, stdio: "ignore" });
writeFileSync(join(out, "index.html"), '<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="styles.css"></head><body><div id="root"></div><script src="bundle.js"></script></body></html>');
mkdirSync(baseline, { recursive: true });

const WIDTHS = [1300, 768, 390];
const MODES = ["light", "dark"];
const MAX_DIFFERENT_SHARE = 0.005; // at most half a percent of pixels may differ
const CHANNEL_TOLERANCE = 12;

const browser = await chromium.launch();
const results = [];
for (const width of WIDTHS) {
  const ctx = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: "reduce", deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(`file://${join(out, "index.html")}`);
  await page.addStyleTag({ content: '[aria-label="Children vaccinated by place"], [aria-label="Where activities are"] { visibility: hidden !important; }' });
  await page.getByTestId("metric-widget").first().waitFor();
  for (const mode of MODES) {
    await page.evaluate((m) => document.documentElement.classList.toggle("dark", m === "dark"), mode);
    await page.waitForTimeout(900);
    const name = `management-${mode}-${width}.png`;
    const shot = await page.locator("#dashboard-canvas").screenshot({ animations: "disabled" });
    const file = join(baseline, name);
    if (update || !existsSync(file)) { writeFileSync(file, shot); results.push(`stored ${name}`); continue; }
    const share = await page.evaluate(async ({ a, b, tol }) => {
      const load = (b64) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = `data:image/png;base64,${b64}`; });
      const [x, y] = await Promise.all([load(a), load(b)]);
      if (x.width !== y.width || x.height !== y.height) return 1;
      const px = (img) => { const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; const g = c.getContext("2d"); g.drawImage(img, 0, 0); return g.getImageData(0, 0, img.width, img.height).data; };
      const p = px(x), q = px(y);
      let diff = 0;
      for (let i = 0; i < p.length; i += 4) if (Math.abs(p[i] - q[i]) > tol || Math.abs(p[i + 1] - q[i + 1]) > tol || Math.abs(p[i + 2] - q[i + 2]) > tol) diff += 1;
      return diff / (p.length / 4);
    }, { a: readFileSync(file).toString("base64"), b: shot.toString("base64"), tol: CHANNEL_TOLERANCE });
    try { assert.ok(share <= MAX_DIFFERENT_SHARE, `${(share * 100).toFixed(2)}% of pixels differ`); results.push(`ok   ${name}`); }
    catch (e) { writeFileSync(join(out, `actual-${name}`), shot); results.push(`FAIL ${name} :: ${e.message} (actual picture: ${join(out, `actual-${name}`)})`); }
  }
  await ctx.close();
}
await browser.close();
console.log(results.join("\n"));
if (results.some((r) => r.startsWith("FAIL"))) process.exit(1);
process.exit(0);
