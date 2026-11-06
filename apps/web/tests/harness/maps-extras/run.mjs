// A real-browser check of photos on the map and of map overlays (KML, KMZ, GeoJSON and shapefile files converted in the browser).
//   pnpm --filter @donordesk/web test:maps-extras
import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { build } from "./build.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const web = resolve(here, "../../..");
const out = mkdtempSync(join(tmpdir(), "maps-extras-"));
await build(join(out, "bundle.js"));
execFileSync("npx", ["tailwindcss", "-c", "tailwind.config.ts", "-i", "src/app/globals.css", "-o", join(out, "styles.css")], { cwd: web, stdio: "ignore" });
writeFileSync(join(out, "index.html"), '<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="styles.css"></head><body><div id="root"></div><script src="bundle.js"></script></body></html>');
const url = `file://${join(out, "index.html")}`;

const KML = '<?xml version="1.0"?><kml><Document><Placemark><name>Nile</name><LineString><coordinates>32.5,13.1 32.6,13.2</coordinates></LineString></Placemark><Placemark><name>Well</name><Point><coordinates>32.55,13.15</coordinates></Point></Placemark></Document></kml>';
function zip(files) {
  const locals = [], centrals = []; let offset = 0;
  for (const [name, data] of Object.entries(files)) {
    const nm = Buffer.from(name), body = deflateRawSync(data);
    const l = Buffer.alloc(30); l.writeUInt32LE(0x04034b50, 0); l.writeUInt16LE(8, 8); l.writeUInt32LE(body.length, 18); l.writeUInt32LE(data.length, 22); l.writeUInt16LE(nm.length, 26);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(8, 10); c.writeUInt32LE(body.length, 20); c.writeUInt32LE(data.length, 24); c.writeUInt16LE(nm.length, 28); c.writeUInt32LE(offset, 42);
    const local = Buffer.concat([l, nm, body]); locals.push(local); centrals.push(Buffer.concat([c, nm])); offset += local.length;
  }
  const dir = Buffer.concat(centrals), e = Buffer.alloc(22);
  e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(centrals.length, 8); e.writeUInt16LE(centrals.length, 10); e.writeUInt32LE(dir.length, 12); e.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, dir, e]);
}
function shp(points) {
  const head = Buffer.alloc(100); head.writeInt32BE(9994, 0); head.writeInt32LE(1000, 28);
  const recs = points.map(([x, y], i) => { const b = Buffer.alloc(20); b.writeInt32LE(1, 0); b.writeDoubleLE(x, 4); b.writeDoubleLE(y, 12); const h = Buffer.alloc(8); h.writeInt32BE(i + 1, 0); h.writeInt32BE(10, 4); return Buffer.concat([h, b]); });
  const all = Buffer.concat([head, ...recs]); all.writeInt32BE(all.length / 2, 24); return all;
}

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1200, height: 1000 } })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
// The thumbnails point at the app's file route, which does not exist when the page is opened from disk.
page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 200)); });
const results = [];
const check = async (name, fn) => { try { await fn(); results.push(`ok   ${name}`); } catch (e) { results.push(`FAIL ${name} :: ${String(e.message).split("\n").slice(0, 6).join(" ")}`); } };
const calls = async (n) => (await page.evaluate(() => window.__h)).calls.filter((c) => c.name === n);
const text = (loc) => loc.innerText().then((t) => t.replace(/\s+/g, " ").trim());
const file = (name, buffer) => page.locator('input[type=file]').setInputFiles({ name, mimeType: "application/octet-stream", buffer });

await page.goto(url);
await page.waitForSelector("#photos-map");

await check("photos: only images count, the places list puts them on a dot, and what could not be placed is said", async () => {
  const t = await text(page.locator("#photos-map").locator(".."));
  assert.match(t, /3 of 5 photos are on the map, at 1 place\. 1 has a location no place matches\. 1 has no location written\./);
  assert.equal(await text(page.getByTestId("dots")), "Um Gargur Camp:3");
  assert.match(t, /Um Gargur Camp · 3 photos/);
  assert.match(t, /Photos whose location matches no place \(1\)/);
});

await check("photos: a stored image shows a thumbnail through the protected file route; a Drive image is listed by name", async () => {
  const srcs = await page.locator("#photos-map ~ ul img").evaluateAll((e) => e.map((x) => x.getAttribute("src")));
  assert.deepEqual(srcs.sort(), ["/api/files/t/1.jpg", "/api/files/t/2.jpg"]);
  assert.match(await text(page.locator("#photos-map").locator("..")), /5\.jpg/);
});

await check("overlays: a kept overlay is listed, ticking it draws it, unticking clears it", async () => {
  assert.equal(await text(page.getByTestId("drawn")), "nothing drawn");
  await page.getByRole("checkbox", { name: "Rivers" }).check();
  await page.waitForFunction(() => document.querySelector('[data-testid=drawn]').textContent.includes("1 lines"));
  await page.getByRole("checkbox", { name: "Rivers" }).uncheck();
  await page.waitForFunction(() => document.querySelector('[data-testid=drawn]').textContent === "nothing drawn");
});

await check("overlays: a KML file is converted in the browser and drawn; keeping it sends GeoJSON under its name", async () => {
  await file("rivers.kml", Buffer.from(KML));
  await page.waitForFunction(() => document.querySelector('[data-testid=drawn]').textContent.includes("1 points, 1 lines"));
  await page.getByRole("button", { name: "Keep for everyone" }).click();
  await page.waitForFunction(() => window.__h.calls.some((c) => c.name === "add"));
  const [c] = await calls("add");
  assert.equal(c.args[0].name, "rivers.kml");
  assert.equal(JSON.parse(c.args[0].geojson).features.length, 2);
  assert.ok(await page.getByText("rivers", { exact: true }).count() >= 1, "the kept overlay joins the list");
});

await check("overlays: a KMZ (zip) is unpacked by the browser and drawn", async () => {
  await page.reload(); await page.waitForSelector("#photos-map");
  await file("camp.kmz", zip({ "doc.kml": Buffer.from(KML) }));
  await page.waitForFunction(() => document.querySelector('[data-testid=drawn]').textContent.includes("1 points, 1 lines"));
});

await check("overlays: a shapefile zip is read, and a projected one is refused with the way to fix it", async () => {
  await page.reload(); await page.waitForSelector("#photos-map");
  await file("camps.zip", zip({ "camps.shp": shp([[32.5, 13.1], [33, 14]]), "camps.prj": Buffer.from('GEOGCS["GCS_WGS_1984"]') }));
  await page.waitForFunction(() => document.querySelector('[data-testid=drawn]').textContent.includes("2 points"));
  await file("utm.zip", zip({ "utm.shp": shp([[500000, 1400000]]), "utm.prj": Buffer.from('PROJCS["UTM"]') }));
  await page.getByRole("alert").waitFor();
  assert.match(await text(page.getByRole("alert")), /EPSG:4326/);
});

await check("overlays: a file that is too large or of another type is refused in a sentence", async () => {
  await page.reload(); await page.waitForSelector("#photos-map");
  await file("big.kml", Buffer.alloc(3 * 1024 * 1024 + 10, 32));
  await page.getByRole("alert").waitFor();
  assert.match(await text(page.getByRole("alert")), /larger than 3 MB/);
  await file("map.dwg", Buffer.from("x"));
  await page.waitForFunction(() => /shapefile/.test(document.querySelector('[role=alert]')?.textContent ?? ""));
});

await browser.close();
console.log(results.join("\n"));
console.log(`page errors: ${errors.length === 0 ? "none" : "\n" + errors.join("\n")}`);
if (results.some((r) => r.startsWith("FAIL")) || errors.length > 0) process.exit(1);
