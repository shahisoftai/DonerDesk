// A real-browser check of the new interactive map: drawing, drilling down to admin 4 with breadcrumbs, the address, the basemap and its fallback.
//   pnpm --filter @donordesk/web test:maps
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createReadStream, existsSync, mkdtempSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { build } from "./build.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const web = resolve(here, "../../..");
const out = mkdtempSync(join(tmpdir(), "maps-v2-"));
const shots = process.env.MAPS_SHOTS ? resolve(process.env.MAPS_SHOTS) : null;
await build(join(out, "bundle.js"));
// MAPS_FAST=1 skips the (slow) stylesheet build: layout is wrong but every check that reads text, requests and the map still works. MAPS_ONLY=<text>[|<text>] runs only the checks whose name contains one of them.
if (process.env.MAPS_FAST) writeFileSync(join(out, "styles.css"), ".w-full{width:100%}.h-56{height:14rem}.h-64{height:16rem}.h-72{height:18rem}.h-80{height:20rem}.h-\\[26rem\\]{height:26rem}.h-\\[28rem\\]{height:28rem}.overflow-hidden{overflow:hidden}.hidden{display:none}"); else execFileSync("npx", ["tailwindcss", "-c", "tailwind.config.ts", "-i", "src/app/globals.css", "-o", join(out, "styles.css")], { cwd: web, stdio: "ignore" });
writeFileSync(join(out, "index.html"), '<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="styles.css"><link rel="stylesheet" href="bundle.css"></head><body><div id="root"></div><script src="bundle.js"></script></body></html>');

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".pbf": "application/x-protobuf" };
const requests = [];
// What the share-link endpoint answers: this project's results at whatever level and period were asked (the page only needs the level echoed).
const SHARED_RESULTS = (level) => ({ level, levelsAvailable: [2], periods: [{ id: "p1", label: "January" }, { id: "p2", label: "February" }], noPlaces: false, withoutLocation: [], indicators: [{ id: "i1", code: "IND-1", name: "People reached", unit: "people", type: "NUMBER", isRate: false, rollup: { level, additive: true, rows: [], unplaced: [] } }] });
// An uploaded admin 4 layer for Uganda: a grid of wards over the whole country, so wherever the map is opened there are some.
const WARDS = { type: "FeatureCollection", features: Array.from({ length: 144 }, (_, i) => { const x = 29.5 + (i % 12) * 0.5, y = -1.5 + Math.floor(i / 12) * 0.5; return { type: "Feature", properties: { name: `Ward ${i + 1}`, id: `UW${String(i + 1).padStart(3, "0")}`, parentId: "" }, geometry: { type: "Polygon", coordinates: [[[x, y], [x + 0.5, y], [x + 0.5, y + 0.5], [x, y + 0.5], [x, y]]] } }; }) };
// Serves the harness page, /geo and /tiles (with byte ranges, which PMTiles needs).
const server = createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  const path = url.pathname === "/" ? join(out, "index.html") : url.pathname.startsWith("/geo/") || url.pathname.startsWith("/tiles/") || url.pathname.startsWith("/vendor/") ? join(web, "public", decodeURIComponent(url.pathname)) : join(out, decodeURIComponent(url.pathname));
  requests.push({ path: url.pathname, range: req.headers.range ?? null });
  if (/^\/api\/shared\/dashboard\/[^/]+\/map-results$/.test(url.pathname)) { requests.push({ path: url.pathname, query: Object.fromEntries(url.searchParams) }); res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(SHARED_RESULTS(Number(url.searchParams.get("level"))))); return; }
  if (url.pathname === "/api/organization/boundary-layers/UGA/4") { res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(WARDS)); return; }
  if (!existsSync(path) || !statSync(path).isFile()) { res.writeHead(404).end(); return; }
  const size = statSync(path).size;
  const type = TYPES[extname(path)] ?? "application/octet-stream";
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? "");
  if (m) {
    const start = Number(m[1] || 0), end = Math.min(size - 1, m[2] ? Number(m[2]) : size - 1);
    res.writeHead(206, { "content-type": type, "accept-ranges": "bytes", "content-range": `bytes ${start}-${end}/${size}`, "content-length": end - start + 1 });
    createReadStream(path, { start, end }).pipe(res);
  } else { res.writeHead(200, { "content-type": type, "accept-ranges": "bytes", "content-length": size }); createReadStream(path).pipe(res); }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch({ args: ["--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await (await browser.newContext({ viewport: { width: 1300, height: 900 } })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|404/.test(m.text())) errors.push(m.text().slice(0, 200)); });
const results = [];
const check = async (name, fn) => { const only = (process.env.MAPS_ONLY ?? "").split("|").filter(Boolean); if (only.length > 0 && !only.some((o) => name.includes(o))) return; let line; try { await fn(); line = `ok   ${name}`; } catch (e) { line = `FAIL ${name} :: ${String(e.message).split("\n").slice(0, 6).join(" ")}`; } results.push(line); console.log(line); };
const text = (loc) => loc.innerText().then((t) => t.replace(/\s+/g, " ").trim());
const crumbs = () => page.locator('nav[aria-label="Map location"]').innerText().then((t) => t.replace(/\s+/g, " ").replace(/ › /g, ">").trim());
const shot = async (name) => { if (shots) await page.screenshot({ path: join(shots, `${name}.png`) }); };
const canvas = page.locator(".maplibregl-canvas");
const settle = (ms = 1500) => page.waitForTimeout(ms);
const clickMap = async (fx = 0.5, fy = 0.5) => { const b = await canvas.boundingBox(); await page.mouse.click(b.x + b.width * fx, b.y + b.height * fy); };

await page.goto(base);
await page.waitForSelector(".maplibregl-canvas", { timeout: 30000 });
await settle(2500);

await check("the map opens on the project's country, with a canvas, controls and a scale bar", async () => {
  assert.equal(await crumbs(), "World>Uganda");
  assert.equal(await page.locator(".maplibregl-canvas").count(), 1);
  assert.ok(await page.locator(".maplibregl-ctrl-zoom-in").count() >= 1);
  assert.ok(await page.locator(".maplibregl-ctrl-scale").count() >= 1);
  await shot("01-uganda-provinces");
});

await check("place tree: lists the places the project touches, with counts rolled up to the country", async () => {
  const tree = page.getByTestId("place-tree");
  await tree.waitFor({ timeout: 5000 });
  const uganda = tree.getByRole("treeitem", { name: /^Uganda/ });
  assert.match(await text(uganda), /Uganda\s*4/);          // 3 at the clinic + 1 at Gulu, rolled up
  assert.match(await text(tree.getByRole("treeitem", { name: /^Gulu/ })), /Gulu\s*4/);
  assert.equal(await tree.getByRole("treeitem", { name: /^Arua/ }).count(), 1);   // Arua has a figure, so it is listed
});

await check("place tree: choosing a place takes the map to it and opens its details", async () => {
  const tree = page.getByTestId("place-tree");
  await tree.getByRole("treeitem", { name: /^Arua/ }).click();
  const details = page.getByRole("complementary", { name: "Place details" });
  await details.waitFor({ timeout: 5000 });
  assert.match(await text(details), /Arua/);
  assert.equal(await tree.getByRole("treeitem", { name: /^Arua/ }).getAttribute("aria-selected"), "true");
});

await check("place tree: arrow keys move, Right opens a place, Enter chooses it", async () => {
  const tree = page.getByTestId("place-tree");
  await tree.getByRole("treeitem", { name: /^Gulu/ }).focus();
  await page.keyboard.press("ArrowRight");               // opens Gulu (the clinic below it)
  await tree.getByRole("treeitem", { name: /^Lacor Clinic/ }).waitFor({ timeout: 3000 });
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  assert.equal(await tree.getByRole("treeitem", { name: /^Lacor Clinic/ }).getAttribute("aria-selected"), "true");
  await page.keyboard.press("ArrowLeft");                // from a leaf: back to the parent
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("data-node")), "gulu");
});

// The tree checks leave the map selected and drilled; the checks after them start from a fresh page.
await page.goto(base);
await page.waitForSelector(".maplibregl-canvas", { timeout: 30000 });
await settle(2500);

await check("the ground is our own: street tiles are read from /tiles with byte ranges, and nothing is fetched from another host", async () => {
  assert.ok(requests.some((r) => r.path === "/tiles/basemap-africa.pmtiles" && r.range), "no ranged read of the basemap");
  assert.ok(requests.some((r) => r.path.startsWith("/tiles/fonts/")), "no label font was read");
});

await check("clicking a boundary opens the place panel with a button that names the level below", async () => {
  await clickMap();
  await page.getByRole("complementary", { name: "Place details" }).waitFor({ timeout: 5000 });
  assert.match(await text(page.getByRole("button", { name: /^Open its / })), /Open its (districts|sub-districts)/);
  await shot("02-selected");
});

await check("opening drills down one level at a time to admin 4, each step adding a breadcrumb", async () => {
  let depth = 2;
  for (let i = 0; i < 4; i++) {
    const open = page.getByRole("button", { name: /^Open its / });
    if (!(await open.count())) break;
    await open.click();
    await settle(2200);
    depth++;
    await clickMap();
    await settle(800);
  }
  const trail = await crumbs();
  assert.ok(trail.split(">").length >= 4, `only ${trail}`);
  await shot("03-deep");
});

await check("the address records where the map is, so the view can be bookmarked", async () => {
  const u = new URL(page.url());
  assert.match(u.searchParams.get("map") ?? "", /^0:name:uganda(\/\d:[A-Za-z0-9_.:-]+)+$/);
});

await check("a breadcrumb goes back to that level, and World goes back to the whole map", async () => {
  await page.locator('nav[aria-label="Map location"]').getByRole("button", { name: "Uganda" }).click();
  await settle(1500);
  assert.equal(await crumbs(), "World>Uganda");
  await page.locator('nav[aria-label="Map location"]').getByRole("button", { name: "World" }).click();
  await settle(1500);
  assert.equal(await crumbs(), "World");
  await shot("04-world");
});

await check("choosing Plain ground stops reading street tiles; the world view says streets are not available", async () => {
  assert.match(await text(page.locator("body")), /Streets and terrain are not available for this area yet/);
  await page.getByLabel("Ground").selectOption("plain");
  await settle(800);
  assert.doesNotMatch(await text(page.locator("body")), /Streets and terrain are not available/);
});

await check("the page survives a reload on a bookmarked address", async () => {
  await page.goto(`${base}?map=0:name:uganda`);
  await page.waitForSelector(".maplibregl-canvas", { timeout: 30000 });
  await settle(2000);
  assert.equal(await crumbs(), "World>Uganda");
});


// ---- the pin picker, as a form uses it --------------------------------------------------------------------------------------------
const ctx = await browser.newContext({ viewport: { width: 900, height: 1000 }, permissions: ["geolocation"], geolocation: { latitude: 2.7701, longitude: 32.2701, accuracy: 20 } });
const pin = await ctx.newPage();
pin.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
pin.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|404/.test(m.text())) errors.push(m.text().slice(0, 200)); });
await pin.goto(`${base}?page=marker`);
await pin.waitForSelector(".maplibregl-canvas", { timeout: 30000 });
await pin.waitForTimeout(2500);
const val = () => pin.getByTestId("value").innerText();
const by = () => pin.getByTestId("by").innerText();
const pinCanvas = pin.locator(".maplibregl-canvas");
const pinShot = async (name) => { if (shots) await pin.screenshot({ path: join(shots, `${name}.png`) }); };

await check("pin: opens on the country with no pin, and says so", async () => {
  assert.equal(await val(), "none");
  assert.match(await pin.locator("body").innerText(), /No pin yet\./);
  await pinShot("10-pin-open");
});

await check("pin: a click drops the pin, rounded and inside Uganda, and the form is told it came from the map", async () => {
  const b = await pinCanvas.boundingBox();
  await pin.mouse.click(b.x + b.width * 0.5, b.y + b.height * 0.5);
  await pin.waitForFunction(() => document.querySelector("[data-testid=value]").textContent !== "none");
  const [lat, lng] = (await val()).split(",").map(Number);
  assert.ok(lat > -2 && lat < 5 && lng > 29 && lng < 36, `outside Uganda: ${await val()}`);
  assert.ok(String(lat).length <= 8, "not rounded");
  assert.equal(await by(), "MAP_PIN");
  assert.equal(await pin.locator(".maplibregl-marker").count(), 1);
});

await check("pin: typed coordinates move the pin and name the areas it falls inside, finest boundaries included", async () => {
  await pin.getByLabel("Latitude").fill("2.77");
  await pin.getByLabel("Longitude").fill("32.27");
  await pin.getByRole("button", { name: "Set", exact: true }).click();
  await pin.waitForFunction(() => document.querySelector("[data-testid=value]").textContent === "2.77,32.27");
  assert.equal(await by(), "TYPED");
  await pin.getByTestId("pin-inside").waitFor({ timeout: 15000 });
  const t = await pin.getByTestId("pin-inside").innerText();
  assert.match(t, /This point is inside: .+\(province\)/);
  assert.match(t, /\((district|sub-district|parish|ward)/);
  await pinShot("11-pin-inside");
});

await check("pin: a value out of range is refused with a sentence and the pin stays where it was", async () => {
  await pin.getByLabel("Latitude").fill("95");
  await pin.getByRole("button", { name: "Set", exact: true }).click();
  assert.equal(await pin.getByRole("alert").innerText(), "Latitude is between -90 and 90.");
  assert.equal(await val(), "2.77,32.27");
});

await check("pin: nudging moves it about ten metres and the readout follows", async () => {
  await pin.getByLabel("Latitude").fill("2.77");
  await pin.getByRole("button", { name: "Nudge north 10 m" }).click();
  await pin.waitForFunction(() => document.querySelector("[data-testid=value]").textContent !== "2.77,32.27");
  const [lat, lng] = (await val()).split(",").map(Number);
  assert.ok(lat > 2.77 && lat < 2.7702, `lat ${lat}`);
  assert.equal(lng, 32.27);
  assert.match(await pin.getByTestId("pin-readout").innerText(), /^2\.7700\d, 32\.27000$/);
});

await check("pin: dragging the marker moves the pin and reports it from the map", async () => {
  const before = await val();
  const m = await pin.locator(".maplibregl-marker").boundingBox();
  await pin.mouse.move(m.x + m.width / 2, m.y + m.height / 2);
  await pin.mouse.down();
  await pin.mouse.move(m.x + m.width / 2 + 40, m.y + m.height / 2 + 30, { steps: 8 });
  await pin.mouse.up();
  await pin.waitForFunction((v) => document.querySelector("[data-testid=value]").textContent !== v, before);
  assert.notEqual(await val(), before);
  assert.equal(await by(), "MAP_PIN");
});

await check("pin: undo steps back through the changes, one at a time", async () => {
  const dragged = await val();
  await pin.getByRole("button", { name: "Undo" }).click();
  await pin.waitForFunction((v) => document.querySelector("[data-testid=value]").textContent !== v, dragged);
  assert.match(await val(), /^2\.7700\d,32\.27$/);
  await pin.getByRole("button", { name: "Undo" }).click();
  await pin.waitForFunction(() => document.querySelector("[data-testid=value]").textContent === "2.77,32.27");
});

await check("pin: the device's location sets the pin, marked as GPS; a rough fix says so", async () => {
  await pin.getByRole("button", { name: "Use my location" }).click();
  await pin.waitForFunction(() => document.querySelector("[data-testid=value]").textContent === "2.7701,32.2701");
  assert.equal(await by(), "GPS");
  assert.equal(await pin.getByRole("status").count(), 0);
  await ctx.setGeolocation({ latitude: 2.8, longitude: 32.3, accuracy: 480 });
  await pin.getByRole("button", { name: "Use my location" }).click();
  await pin.waitForFunction(() => document.querySelector("[data-testid=value]").textContent === "2.8,32.3");
  assert.match(await pin.getByRole("status").innerText(), /accurate to about 480 m/);
  await pinShot("12-pin-gps");
});

await check("pin: removing it clears the form's value and the marker", async () => {
  await pin.getByRole("button", { name: "Remove the pin" }).click();
  await pin.waitForFunction(() => document.querySelector("[data-testid=value]").textContent === "none");
  assert.equal(await pin.locator(".maplibregl-marker").count(), 0);
});

// ---- drawing an outline or a route ------------------------------------------------------------------------------------------------
const dctx = await browser.newContext({ viewport: { width: 900, height: 1100 } });
const dr = await dctx.newPage();
dr.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
dr.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|404/.test(m.text())) errors.push(m.text().slice(0, 200)); });
await dr.goto(`${base}?page=drawer`);
await dr.waitForSelector(".maplibregl-canvas", { timeout: 30000 });
await dr.waitForTimeout(3000);
const dcanvas = dr.locator(".maplibregl-canvas");
const shape = () => dr.getByTestId("shape").innerText();
const verdict = () => dr.getByTestId("verdict").innerText();
const drShot = async (name) => { if (shots) await dr.screenshot({ path: join(shots, `${name}.png`) }); };
const at = async (fx, fy) => { const b = await dcanvas.boundingBox(); return [b.x + b.width * fx, b.y + b.height * fy]; };
const clickAt = async (fx, fy, opts = {}) => { const [x, y] = await at(fx, fy); await dr.mouse.click(x, y, opts); await dr.waitForTimeout(250); };
const SQUARE = [[0.35, 0.3], [0.65, 0.3], [0.65, 0.65], [0.35, 0.65]];

await check("draw: starts with nothing drawn; editing and removing wait for a shape", async () => {
  assert.equal(await shape(), "none");
  assert.equal(await dr.getByRole("button", { name: "Edit corners" }).isDisabled(), true);
  assert.equal(await dr.getByRole("button", { name: "Remove the shape" }).isDisabled(), true);
  assert.match(await dr.getByTestId("draw-help").innerText(), /Draw an outline for an area/);
});

await check("draw: clicking the corners and the last one again finishes an outline, checked by the domain's rule", async () => {
  await dr.getByRole("button", { name: "Draw an outline" }).click();
  assert.match(await dr.getByTestId("draw-help").innerText(), /Click each corner/);
  for (const [fx, fy] of SQUARE) await clickAt(fx, fy);
  await clickAt(...SQUARE[3]);
  await dr.waitForFunction(() => document.querySelector("[data-testid=shape]").textContent !== "none", null, { timeout: 20000 });
  assert.equal(await verdict(), "ok POLYGON 4");
  assert.equal(await dr.getByTestId("shape-summary").innerText(), "Outline · corners: 4");
  const g = JSON.parse(await shape());
  assert.equal(g.type, "Polygon");
  assert.equal(g.coordinates[0].length, 5);
  assert.match(await dr.getByTestId("draw-help").innerText(), /Draw an outline for an area/);
  await drShot("20-drawn");
});

await check("draw: Edit corners lets a corner be dragged, and the shape reported changes", async () => {
  const before = await shape();
  await dr.getByRole("button", { name: "Edit corners" }).click();
  assert.match(await dr.getByTestId("draw-help").innerText(), /Drag a corner/);
  const [x, y] = await at(...SQUARE[0]);
  await dr.mouse.move(x, y);
  await dr.mouse.down();
  await dr.mouse.move(x - 40, y - 30, { steps: 10 });
  await dr.mouse.up();
  await dr.waitForFunction((b) => document.querySelector("[data-testid=shape]").textContent !== b, before, { timeout: 20000 });
  assert.notEqual(await shape(), before);
  assert.match(await verdict(), /^ok POLYGON/);
  await drShot("21-edited");
});

await check("draw: removing the shape clears it and the control says nothing is drawn", async () => {
  await dr.getByRole("button", { name: "Remove the shape" }).click();
  await dr.waitForFunction(() => document.querySelector("[data-testid=shape]").textContent === "none");
  assert.equal(await dr.getByRole("button", { name: "Edit corners" }).isDisabled(), true);
});

await check("draw: a route of three points is accepted as a line", async () => {
  await dr.getByRole("button", { name: "Draw a route" }).click();
  await clickAt(0.3, 0.6); await clickAt(0.5, 0.4); await clickAt(0.7, 0.55); await clickAt(0.7, 0.55);
  await dr.waitForFunction(() => document.querySelector("[data-testid=shape]").textContent !== "none", null, { timeout: 20000 });
  assert.equal(await verdict(), "ok LINE 3");
  assert.equal(await dr.getByTestId("shape-summary").innerText(), "Route · points: 3");
});

await check("draw: an outline that crosses itself is never accepted as good (refused while drawing, or named by the check)", async () => {
  await dr.getByRole("button", { name: "Draw an outline" }).click();
  for (const [fx, fy] of [[0.35, 0.3], [0.65, 0.65], [0.65, 0.3], [0.35, 0.65]]) await clickAt(fx, fy);
  await clickAt(0.35, 0.65);
  await dr.waitForTimeout(800);
  const v = await verdict();
  assert.ok(v === "-" || /^bad .*crosses itself/.test(v), `accepted a crossing outline: ${v}`);
});

// ---- the outline editor of one place -----------------------------------------------------------------------------------------------
async function editorPage(has) {
  const c = await browser.newContext({ viewport: { width: 900, height: 1100 } });
  const p = await c.newPage();
  p.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  if (has) await p.addInitScript(() => { window.__h = { calls: [], shapes: { camp: { type: "Polygon", coordinates: [[[32.2, 2.7], [32.3, 2.7], [32.3, 2.8], [32.2, 2.8], [32.2, 2.7]]] } } }; });
  await p.goto(`${base}?page=editor${has ? "&has=1" : ""}`);
  await p.waitForSelector(".maplibregl-canvas", { timeout: 30000 });
  await p.waitForTimeout(3000);
  return p;
}
const calls = (p) => p.evaluate(() => window.__h.calls.map((c) => c.name));

await check("editor: Save stays off until a good shape is drawn; saving stores it through the action, refreshes and closes", async () => {
  const p = await editorPage(false);
  assert.equal(await p.getByRole("button", { name: "Save the outline" }).isDisabled(), true);
  const b = await p.locator(".maplibregl-canvas").boundingBox();
  const click = async (fx, fy) => { await p.mouse.click(b.x + b.width * fx, b.y + b.height * fy); await p.waitForTimeout(250); };
  await p.getByRole("button", { name: "Draw an outline" }).click();
  for (const [fx, fy] of SQUARE) await click(fx, fy);
  await click(...SQUARE[3]);
  await p.waitForFunction(() => !document.querySelector("button[disabled]") || [...document.querySelectorAll("button")].find((x) => x.textContent === "Save the outline" && !x.disabled), null, { timeout: 20000 });
  await p.getByRole("button", { name: "Save the outline" }).click();
  await p.waitForFunction(() => window.__closed === true, null, { timeout: 20000 });
  assert.deepEqual(await calls(p), ["set"]);
  assert.ok((await p.evaluate(() => window.__refreshes)) >= 1);
  assert.equal(await p.evaluate(() => window.__h.shapes.camp.type), "Polygon");
  await p.context().close();
});

await check("editor: a stored shape is loaded; removing it asks for the removal, then clears it through the action", async () => {
  const p = await editorPage(true);
  assert.deepEqual((await calls(p)).includes("get"), true);
  await p.getByTestId("shape-summary").waitFor({ timeout: 20000 });
  assert.equal(await p.getByTestId("shape-summary").innerText(), "Outline · corners: 4");
  assert.equal(await p.getByRole("button", { name: "Save the outline" }).isDisabled(), true);
  await p.getByRole("button", { name: "Remove the shape" }).click();
  await p.getByRole("button", { name: "Remove the outline from this place" }).click();
  await p.waitForFunction(() => window.__closed === true, null, { timeout: 20000 });
  assert.ok((await calls(p)).includes("clear"));
  assert.equal(await p.evaluate(() => window.__h.shapes.camp), undefined);
  await p.context().close();
});

// ---- boundary files an organisation uploads ----------------------------------------------------------------------------------------
const layerMeta = { iso: "UGA", countryName: "Uganda", adminLevel: 4, name: "kampala-wards", featureCount: 144, sizeBytes: 90000, hasCodes: true, uploadedAt: "2026-11-03T00:00:00Z" };
const lctx = await browser.newContext({ viewport: { width: 1300, height: 900 } });
const lp = await lctx.newPage();
await lp.addInitScript((m) => { window.__layers = [m]; }, layerMeta);
lp.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
lp.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|404/.test(m.text())) errors.push(m.text().slice(0, 200)); });
await lp.goto(base);
await lp.waitForSelector(".maplibregl-canvas", { timeout: 30000 });
await lp.waitForTimeout(3000);

await check("uploaded layer: drilling to the uploaded level draws the organisation's file and credits it; the levels above keep the shipped credit", async () => {
  const lb = await lp.locator(".maplibregl-canvas").boundingBox();
  const centre = async () => { await lp.mouse.click(lb.x + lb.width * 0.5, lb.y + lb.height * 0.5); await lp.waitForTimeout(900); };
  for (let i = 0; i < 4; i++) {
    await centre();
    const open = lp.getByRole("button", { name: /^Open its / });
    if (!(await open.count())) break;
    if (i === 2) assert.equal(await lp.getByTestId("boundary-credit").count(), 0, "a shipped level must not claim to be the organisation's upload");
    await open.click();
    await lp.waitForTimeout(2200);
  }
  await lp.getByTestId("boundary-credit").waitFor({ timeout: 10000 });
  assert.equal(await lp.getByTestId("boundary-credit").innerText(), "Uganda boundaries: uploaded by your organisation (kampala-wards).");
  assert.ok(requests.some((r) => r.path === "/api/organization/boundary-layers/UGA/4"), "the uploaded file was never fetched");
  await lp.mouse.click(lb.x + lb.width * 0.5, lb.y + lb.height * 0.5);
  await lp.getByRole("complementary", { name: "Place details" }).waitFor({ timeout: 20000 });
  assert.match(await lp.getByRole("complementary", { name: "Place details" }).innerText(), /Ward \d+/);
  if (shots) await lp.screenshot({ path: join(shots, "30-uploaded-layer.png") });
});

const card = async (layers) => {
  const c = await browser.newContext({ viewport: { width: 900, height: 1100 } });
  const p = await c.newPage();
  await p.addInitScript((l) => { window.__layers = l; }, layers);
  p.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  await p.goto(`${base}?page=boundary-card`);
  await p.getByRole("heading", { name: "Boundaries for a country and level" }).waitFor({ timeout: 30000 });
  await p.waitForTimeout(800);
  return p;
};
const WARD_FILE = JSON.stringify({ type: "FeatureCollection", features: [["Kisenyi", "UG0101"], ["Nakawa", "UG0102"]].map(([n, c], i) => ({ type: "Feature", properties: { ADM4_EN: n, ADM4_PCODE: c, ADM3_PCODE: "UG01", AREA: i }, geometry: { type: "Polygon", coordinates: [[[32 + i, 0.3], [33 + i, 0.3], [33 + i, 1.3], [32 + i, 1.3], [32 + i, 0.3]]] } })) });

await check("settings card: a file is read in the browser, the columns are suggested, and Upload waits for the country", async () => {
  const p = await card([]);
  assert.match(await p.locator("body").innerText(), /No boundary files uploaded/);
  await p.getByLabel("Boundary file").setInputFiles({ name: "wards.geojson", mimeType: "application/json", buffer: Buffer.from(WARD_FILE) });
  await p.getByTestId("boundary-guide").waitFor({ timeout: 5000 });
  assert.match(await p.getByTestId("boundary-guide").innerText(), /2 boundaries found/);
  assert.equal(await p.getByLabel("Name column", { exact: true }).inputValue(), "ADM4_EN");
  assert.equal(await p.getByLabel("Code column", { exact: true }).inputValue(), "ADM4_PCODE");
  assert.equal(await p.getByLabel("Parent's code column").inputValue(), "ADM3_PCODE");
  assert.equal(await p.getByRole("button", { name: "Upload boundaries" }).isDisabled(), true);
  await p.getByLabel("Country", { exact: true }).fill("Uganda");
  assert.equal(await p.getByLabel("Country code").inputValue(), "UGA", "the code follows the country");
  assert.equal(await p.getByRole("button", { name: "Upload boundaries" }).isDisabled(), false);
  await p.getByRole("button", { name: "Upload boundaries" }).click();
  await p.waitForFunction(() => window.__h && window.__h.calls.some((c) => c.name === "upload"), null, { timeout: 20000 });
  const sent = await p.evaluate(() => window.__h.calls.find((c) => c.name === "upload").args[0]);
  assert.deepEqual(sent, { iso: "UGA", countryName: "Uganda", adminLevel: "4", nameField: "ADM4_EN", pcodeField: "ADM4_PCODE", parentPcodeField: "ADM3_PCODE", file: "file:wards.geojson" });
  await p.context().close();
});

await check("settings card: a file that is not GeoJSON is refused on the spot with a sentence, and a level change re-suggests the parent column", async () => {
  const p = await card([]);
  await p.getByLabel("Boundary file").setInputFiles({ name: "x.geojson", mimeType: "application/json", buffer: Buffer.from("this is not json") });
  assert.match(await p.getByRole("alert").innerText(), /not valid JSON/);
  await p.getByLabel("Boundary file").setInputFiles({ name: "wards.geojson", mimeType: "application/json", buffer: Buffer.from(WARD_FILE) });
  await p.getByTestId("boundary-guide").waitFor();
  await p.getByLabel("Level", { exact: true }).selectOption("2");
  await p.waitForTimeout(300);
  assert.equal(await p.getByLabel("Parent's code column").inputValue(), "", "no parent column fits a level 2 file, so none is guessed");
  await p.context().close();
});

await check("settings card: an uploaded file is listed with its country, level and what it holds, and can be removed", async () => {
  const p = await card([layerMeta]);
  const t = await p.locator("body").innerText();
  assert.match(t, /Uganda · parishes, wards and communes · kampala-wards/);
  assert.match(t, /144 boundaries · 0\.09 MB · with codes/);
  await p.getByRole("button", { name: "Remove the parishes, wards and communes of Uganda" }).click();
  await p.waitForFunction(() => window.__h && window.__h.calls.some((c) => c.name === "remove"), null, { timeout: 20000 });
  assert.deepEqual(await p.evaluate(() => window.__h.calls.find((c) => c.name === "remove").args), ["UGA", 4]);
  await p.context().close();
});

// ---- a results map on a shared dashboard ------------------------------------------------------------------------------------------
async function sharedPage(query = "") {
  const c = await browser.newContext({ viewport: { width: 1000, height: 1000 } });
  const p = await c.newPage();
  p.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  p.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|404/.test(m.text())) errors.push(m.text().slice(0, 200)); });
  await p.goto(`${base}?page=shared-map${query}`);
  await p.waitForSelector(".maplibregl-canvas", { timeout: 30000 });
  await p.waitForTimeout(3000);
  return p;
}
const sharedReads = () => requests.filter((r) => /map-results$/.test(r.path) && r.query);

await check("share link: the map moves through the periods and opens places by asking the link, naming only its own widget (never a project)", async () => {
  const before = sharedReads().length;
  const p = await sharedPage();
  assert.equal(await p.getByText("Opening a place and moving the time slider read the recorded figures as they stand now.").count(), 1);
  await p.getByLabel("Reporting period").fill("1");
  await p.waitForFunction(() => document.querySelector("output")?.textContent === "January");
  await p.waitForTimeout(1500);
  const reads = sharedReads().slice(before);
  const withPeriod = reads.find((r) => r.query?.periodId === "p1");
  assert.ok(withPeriod, "moving the slider never asked the link for that period");
  assert.deepEqual(Object.keys(withPeriod.query).sort(), ["level", "periodId", "widget"], "only the widget, the level and the period are sent");
  assert.equal(withPeriod.query.widget, "w-results");
  assert.match(withPeriod.path, /\/api\/shared\/dashboard\/abcdefghijklmnopqrstuvwxyz0123456789\/map-results$/);
  await p.context().close();
});

await check("share link: a place can be opened a level down, and the map asks the link for that level", async () => {
  const p = await sharedPage();
  const b = await p.locator(".maplibregl-canvas").boundingBox();
  await p.mouse.click(b.x + b.width * 0.5, b.y + b.height * 0.5);
  const open = p.getByRole("button", { name: /^Open its / });
  await open.waitFor({ timeout: 20000 });
  const before = sharedReads().length;
  await open.click();
  // The finer level is asked for once the boundaries below it have loaded: wait for the request rather than for a fixed time (a slow run is not a failure).
  const asked = () => sharedReads().slice(before).filter((r) => r.query).some((r) => Number(r.query.level) >= 2);
  for (let waited = 0; !asked() && waited < 15000; waited += 250) await p.waitForTimeout(250);
  assert.ok(asked(), "opening a place never asked the link for the finer level");
  assert.ok((await p.locator('nav[aria-label="Map location"]').innerText()).split("›").length >= 3);
  await p.context().close();
});

await check("share link: with no link the map stays the fixed view it was sent as (no slider, no opening, a note saying so)", async () => {
  const p = await sharedPage("&nolink=1");
  assert.equal(await p.getByLabel("Reporting period").count(), 0);
  const b = await p.locator(".maplibregl-canvas").boundingBox();
  await p.mouse.click(b.x + b.width * 0.5, b.y + b.height * 0.5);
  await p.waitForTimeout(800);
  assert.equal(await p.getByRole("button", { name: /^Open its / }).count(), 0);
  assert.match(await p.locator("body").innerText(), /A fixed view for this link/);
  await p.context().close();
});

// ---- the sites map (plan, Overview, portfolio, photos) ------------------------------------------------------------------------------
await check("sites map: one dot for the site, with a tooltip naming where it is, each item with its state and each open risk", async () => {
  const c = await browser.newContext({ viewport: { width: 900, height: 800 } });
  const p = await c.newPage();
  p.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  p.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errors.push(`${m.type()}: ${m.text().slice(0, 240)}`); });
  await p.goto(`${base}?page=sites`);
  await p.waitForSelector(".maplibregl-canvas", { timeout: 30000 });
  await p.waitForTimeout(3500);
  assert.equal(await p.getByRole("group", { name: "Where we work" }).count(), 1);
  assert.match(await p.locator("figcaption").innerText(), /Where we work/);
  const b = await p.locator(".maplibregl-canvas").boundingBox();
  await p.mouse.move(b.x + b.width * 0.5, b.y + b.height * 0.5);
  await p.waitForSelector(".maplibregl-popup", { timeout: 20000 }).catch(async (e) => { if (shots) await p.screenshot({ path: join(shots, "31-sites-map-FAILED.png") }); throw e; });
  const tip = await p.locator(".maplibregl-popup").innerText();
  assert.match(tip, /Gulu/);
  assert.match(tip, /Northern, Uganda/);
  assert.match(tip, /Train staff — Late/);
  assert.match(tip, /Survey — Done/);
  assert.match(tip, /Road washed out/);
  if (shots) await p.screenshot({ path: join(shots, "31-sites-map.png") });
  await p.context().close();
});

await check("explorer: comparing the latest periods draws a small map for each period, on the same scale", async () => {
  const c = await browser.newContext({ viewport: { width: 1300, height: 1000 } });
  const p = await c.newPage();
  p.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  await p.goto(`${base}?periods=1`);
  await p.waitForSelector(".maplibregl-canvas", { timeout: 30000 });
  await p.waitForTimeout(2500);
  const before = await p.locator(".maplibregl-canvas").count();
  await p.getByLabel("Compare the latest periods side by side").check();
  await p.waitForFunction((n) => document.querySelectorAll(".maplibregl-canvas").length >= n + 2, before, { timeout: 20000 });
  const captions = await p.locator('[aria-label="Periods side by side"] figcaption').allInnerTexts();
  assert.deepEqual(captions, ["January", "February"]);
  await p.waitForTimeout(2000);
  await p.getByLabel("Compare the latest periods side by side").uncheck();
  await p.waitForFunction((n) => document.querySelectorAll(".maplibregl-canvas").length === n, before, { timeout: 10000 });
  await p.context().close();
});

// ---- access: the keyboard, the table, low data, other languages -------------------------------------------------------------------
const mapRequests = (from) => requests.slice(from).filter((r) => r.path.startsWith("/tiles/") || r.path.startsWith("/geo/")).length;

await check("keyboard only: the map's own canvas is a tab stop and the arrow keys move it", async () => {
  const c = await browser.newContext({ viewport: { width: 1300, height: 1000 } });
  const p = await c.newPage();
  await p.goto(base);
  await p.waitForSelector(".maplibregl-canvas", { timeout: 30000 });
  await p.waitForTimeout(3000);
  assert.equal(await p.locator(".maplibregl-canvas").getAttribute("tabindex"), "0");
  assert.match(await p.locator(".maplibregl-canvas").getAttribute("aria-label"), /places have a figure|Places with a figure/);
  const before = await p.locator(".maplibregl-canvas").screenshot();
  await p.locator(".maplibregl-canvas").focus();
  for (let i = 0; i < 6; i++) await p.keyboard.press("ArrowRight");
  await p.waitForTimeout(1200);
  const after = await p.locator(".maplibregl-canvas").screenshot();
  assert.notDeepEqual(before, after, "six presses of the right arrow did not move the map");
  await c.close();
});

await check("keyboard only: the table lists the places, and Enter on a row's button opens the place's details", async () => {
  const c = await browser.newContext({ viewport: { width: 1300, height: 1000 } });
  const p = await c.newPage();
  await p.goto(base);
  await p.waitForSelector(".maplibregl-canvas", { timeout: 30000 });
  await p.waitForTimeout(2500);
  await p.getByRole("button", { name: "View as a table" }).focus();
  await p.keyboard.press("Enter");
  const table = p.getByTestId("map-table");
  await table.waitFor({ timeout: 8000 });
  const rows = await table.locator("tbody tr").allInnerTexts();
  assert.equal(rows.length, 3);
  const gulu = rows.find((r) => r.startsWith("Gulu"));
  assert.match(gulu, /1200 people|1,200 people/);
  assert.match(gulu, /Verified/);
  assert.match(rows.find((r) => r.startsWith("Kampala")), /Not measured/, "a place with no figure says so, never 0");
  await p.getByRole("button", { name: "Show details for Gulu" }).focus();
  await p.keyboard.press("Enter");
  await p.getByRole("complementary", { name: "Place details" }).waitFor({ timeout: 8000 });
  assert.match(await p.getByRole("complementary", { name: "Place details" }).innerText(), /Gulu/);
  await c.close();
});

await check("low data: results are a table with no map library, no tiles and no boundary files; 'Show the map anyway' brings the map", async () => {
  const c = await browser.newContext({ viewport: { width: 1300, height: 1000 } });
  await c.addInitScript(() => { try { window.localStorage.setItem("dd-low-data", "on"); } catch { /* none */ } });
  const p = await c.newPage();
  const from = requests.length;
  await p.goto(base);
  await p.getByTestId("map-table").waitFor({ timeout: 30000 });
  await p.waitForTimeout(2000);
  assert.equal(await p.locator(".maplibregl-canvas").count(), 0);
  assert.match(await p.locator("body").innerText(), /Low-data mode is on: the map is shown as a table and no map tiles are loaded\./);
  assert.equal(mapRequests(from), 0, "low-data mode fetched map tiles or boundary files");
  assert.equal(await p.getByTestId("map-table").locator("tbody tr").count(), 3);
  await p.getByRole("button", { name: "Show details for Arua" }).click();
  await p.getByRole("complementary", { name: "Place details" }).waitFor({ timeout: 8000 });
  await p.getByRole("button", { name: "Show the map anyway" }).click();
  await p.waitForSelector(".maplibregl-canvas", { timeout: 30000 });
  await p.waitForTimeout(2500);
  assert.ok(mapRequests(from) > 0, "the map never loaded after being asked for");
  await c.close();
});

await check("low data: the sites map is its table too, and the table is there beside the map the rest of the time", async () => {
  const c = await browser.newContext({ viewport: { width: 900, height: 900 } });
  await c.addInitScript(() => { try { window.localStorage.setItem("dd-low-data", "on"); } catch { /* none */ } });
  const p = await c.newPage();
  const from = requests.length;
  await p.goto(`${base}?page=sites`);
  await p.getByTestId("sites-table").waitFor({ timeout: 30000 });
  await p.waitForTimeout(1500);
  assert.equal(await p.locator(".maplibregl-canvas").count(), 0);
  assert.equal(mapRequests(from), 0);
  const t = await p.getByTestId("sites-table").innerText();
  assert.match(t, /Gulu/);
  assert.match(t, /Train staff — Late/);
  assert.match(t, /Road washed out/);
  await c.close();
  const c2 = await browser.newContext({ viewport: { width: 900, height: 900 } });
  const q = await c2.newPage();
  await q.goto(`${base}?page=sites`);
  await q.waitForSelector(".maplibregl-canvas", { timeout: 30000 });
  assert.equal(await q.getByTestId("sites-table").count(), 0, "the table starts closed beside the map");
  await q.getByRole("button", { name: "View as a table" }).click();
  await q.getByTestId("sites-table").waitFor();
  assert.match(await q.getByTestId("sites-table").innerText(), /Gulu/);
  await c2.close();
});

await check("French: the map's own words are French, from the catalogue", async () => {
  const c = await browser.newContext({ viewport: { width: 1300, height: 1000 } });
  const p = await c.newPage();
  await p.goto(`${base}?locale=fr`);
  await p.waitForSelector(".maplibregl-canvas", { timeout: 30000 });
  await p.waitForTimeout(2500);
  assert.equal(await p.locator("html").getAttribute("dir"), "ltr");
  assert.equal(await p.locator('nav[aria-label="Position sur la carte"]').count(), 1);
  assert.match(await p.locator('nav[aria-label="Position sur la carte"]').innerText(), /Monde/);
  assert.equal(await p.getByRole("button", { name: "Voir sous forme de tableau" }).count(), 1);
  assert.match(await p.locator("body").innerText(), /Lieux avec un chiffre : 2 sur 3/);
  assert.match(await p.locator(".maplibregl-canvas").getAttribute("aria-label"), /Lieux avec un chiffre/);
  await c.close();
});

await check("Arabic: right to left, the words are Arabic, the map is not mirrored, and the right-to-left text plugin is ours", async () => {
  const c = await browser.newContext({ viewport: { width: 1300, height: 1000 } });
  const p = await c.newPage();
  p.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  const from = requests.length;
  await p.goto(`${base}?locale=ar`);
  await p.waitForSelector(".maplibregl-canvas", { timeout: 30000 });
  await p.waitForTimeout(4000);
  assert.equal(await p.locator("html").getAttribute("dir"), "rtl");
  assert.equal(await p.locator("html").getAttribute("lang"), "ar");
  assert.match(await p.locator('nav[aria-label="موقع الخريطة"]').innerText(), /العالم/);
  assert.equal(await p.getByRole("button", { name: "عرض كجدول" }).count(), 1);
  const east = (await p.locator(".maplibregl-canvas").boundingBox());
  assert.ok(east.width > 300, "the map still draws");
  const plugin = requests.slice(from).filter((r) => r.path === "/vendor/mapbox-gl-rtl-text.js");
  assert.ok(plugin.length >= 1, "Arabic labels never asked for the right-to-left text plugin");
  if (shots) await p.screenshot({ path: join(shots, "40-arabic.png") });
  await c.close();
});

await check("pins and drawing speak the person's language too (French)", async () => {
  const c = await browser.newContext({ viewport: { width: 900, height: 1100 } });
  const p = await c.newPage();
  await p.goto(`${base}?page=marker&locale=fr`);
  await p.waitForSelector(".maplibregl-canvas", { timeout: 30000 });
  await p.waitForTimeout(2500);
  assert.equal(await p.getByRole("button", { name: "Utiliser ma position" }).count(), 1);
  await p.getByLabel("Latitude", { exact: true }).fill("95");
  await p.getByLabel("Longitude", { exact: true }).fill("32.27");
  await p.getByRole("button", { name: "Valider", exact: true }).click();
  assert.equal(await p.getByRole("alert").innerText(), "La latitude est comprise entre -90 et 90.");
  await p.goto(`${base}?page=drawer&locale=fr`);
  await p.waitForSelector(".maplibregl-canvas", { timeout: 30000 });
  await p.waitForTimeout(2500);
  assert.equal(await p.getByRole("button", { name: "Dessiner un contour" }).count(), 1);
  await p.getByRole("button", { name: "Dessiner un contour" }).click();
  assert.match(await p.getByTestId("draw-help").innerText(), /Cliquez sur chaque angle/);
  await c.close();
});

await check("indicator page: the map and the target chart sit side by side, the indicator is fixed, and moving the map's period marks it on the chart", async () => {
  await page.goto(`${base}?page=indicator-results`);
  const panel = page.getByTestId("indicator-results");
  await panel.waitFor({ timeout: 30000 });
  await panel.locator(".maplibregl-canvas").first().waitFor({ timeout: 30000 });
  assert.equal(await panel.getByLabel("Indicator", { exact: true }).count(), 0);       // locked: no indicator list
  const chart = panel.locator("figure");
  await chart.locator("canvas").first().waitFor({ timeout: 15000 });
  assert.equal(await chart.getAttribute("data-marked-period"), "");                      // all periods: nothing marked
  const slider = panel.getByRole("slider", { name: "Reporting period" });
  await slider.fill("2");
  await page.waitForFunction(() => document.querySelector('[data-testid="indicator-results"] figure')?.getAttribute("data-marked-period") === "February", null, { timeout: 8000 });
  await slider.fill("3");
  await page.waitForFunction(() => document.querySelector('[data-testid="indicator-results"] figure')?.getAttribute("data-marked-period") === "March", null, { timeout: 8000 });
});

await check("no script or console errors", async () => { assert.deepEqual(errors, []); });

if (process.env.MAPS_ONLY) console.log("errors seen:", JSON.stringify(errors));
await browser.close();
server.close();
if (results.some((r) => r.startsWith("FAIL"))) process.exit(1);
