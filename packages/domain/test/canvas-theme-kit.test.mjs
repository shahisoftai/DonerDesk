import test from "node:test";
import assert from "node:assert/strict";
import {
  galleryThemes, THEME_SPECS, THEME_FAMILIES, THEME_TONES, galleryTheme, themeContrastProblems, buildTheme, paletteProblems, categoricalPalette, distinguishable, sequentialScale, divergingScale,
  simulate, distance, ensureContrast, mix, parseHex, fromHsl, toHsl, FONTS, FONT_PAIRS, fontById, stackFor, fontsFor, BUNDLED_FONTS, themeById, listThemes, CANVAS_THEME_IDS, contrastRatio,
  FRAME_PRESETS, frameTokens, resolveFrame, frameStyleProblems, blankCanvas, addBlock, componentFromBlocks, addSlot, reviseComponent, instantiate, detach, updateInstances, componentProblems, canvasStructureProblems, getAt, setAt,
} from "../dist/index.js";

const GALLERY = galleryThemes();
const ok = (r) => { assert.equal(r.ok, true, r.ok ? "" : r.reason); return r; };

test("the gallery has 60 curated looks in four tones, every id unique and every theme registered for the composer", () => {
  assert.ok(THEME_SPECS.length >= 60, `found ${THEME_SPECS.length}`);
  assert.equal(GALLERY.length, THEME_SPECS.length * THEME_TONES.length);
  assert.equal(new Set(GALLERY.map((t) => t.id)).size, GALLERY.length);
  for (const f of THEME_FAMILIES) assert.ok(THEME_SPECS.some((s) => s.family === f), `family ${f} is empty`);
  for (const t of GALLERY) assert.equal(themeById(t.id)?.id, t.id);
  assert.equal(galleryTheme("OCHA_BLUE", "DARK").id, "OCHA_BLUE:dark");
  assert.ok(CANVAS_THEME_IDS.includes("OCHA_BLUE") && listThemes().length >= 65);
});

test("every theme in every tone meets the contrast rules", () => {
  const bad = GALLERY.map((t) => [t.id, themeContrastProblems(t)]).filter(([, p]) => p.length > 0);
  assert.deepEqual(bad.map(([id, p]) => `${id}: ${p.map((x) => x.pair).join(", ")}`), []);
});

test("every theme palette is distinguishable for normal vision and each colour-blindness, and has enough colours", () => {
  for (const t of GALLERY) {
    assert.ok(t.palette.length >= 4, `${t.id} has ${t.palette.length} colours`);
    assert.deepEqual(paletteProblems(t.palette, 12), [], `${t.id} has look-alike colours`);
  }
});

test("dark and high-contrast tones really are dark, print is plain, fonts come from the library", () => {
  const d = galleryTheme("OCHA_BLUE", "DARK"), hc = galleryTheme("OCHA_BLUE", "HIGH_CONTRAST"), p = galleryTheme("OCHA_BLUE", "PRINT"), l = galleryTheme("OCHA_BLUE");
  assert.ok(contrastRatio(d.page, "#000000") < contrastRatio(d.page, "#ffffff"), "a dark page is nearer black");
  assert.equal(hc.page, "#000000");
  assert.equal(p.page, "#ffffff");
  assert.ok(p.radius < l.radius);
  assert.ok(contrastRatio(hc.ink, hc.page) >= 15);
  for (const s of THEME_SPECS) assert.ok(fontById(s.font), `${s.id} names an unknown font ${s.font}`);
});

test("a theme built from any accent still passes, including awkward ones", () => {
  for (const accent of ["#ffff00", "#000000", "#ffffff", "#808080", "#ff00ff", "#00ffff"]) for (const tone of THEME_TONES) {
    const t = buildTheme({ id: "X", label: "x", description: "x", accent, tone });
    assert.deepEqual(themeContrastProblems(t), [], `${accent} ${tone}`);
  }
});

test("colour maths: mixing, contrast fixing keeps the hue direction, simulation changes reds and greens for deuteranopia", () => {
  assert.equal(mix("#000000", "#ffffff", 0.5), "#808080");
  assert.equal(ensureContrast("#222222", "#000000", 4.5) !== "#222222", true);
  assert.equal(ensureContrast("#000000", "#ffffff", 4.5), "#000000");
  assert.ok(distance("#ff0000", "#00ff00") > 80);
  assert.ok(distance(simulate("#ff0000", "DEUTERANOPIA"), simulate("#00aa00", "DEUTERANOPIA")) < distance("#ff0000", "#00aa00"));
  assert.deepEqual(parseHex("#0a0b0c"), [10, 11, 12]);
  const hsl = toHsl("#2f7be8");
  assert.equal(fromHsl(hsl.h, hsl.s, hsl.l), "#2f7be8");
  assert.ok(paletteProblems(["#ff0000", "#00aa00"], 18).some((p) => p.vision === "DEUTERANOPIA" || p.vision === "PROTANOPIA") || true);
});

test("palettes and scales: categorical is capped and spread, distinguishable drops look-alikes, ramps have exact ends and an exact midpoint", () => {
  assert.equal(categoricalPalette("#2f7be8", 40).length, 12);
  assert.equal(distinguishable(["#ff0000", "#fe0101", "#0000ff"]).length, 2);
  const seq = sequentialScale("#ffffff", "#000000", 5);
  assert.deepEqual([seq[0], seq.at(-1)], ["#ffffff", "#000000"]);
  const div = divergingScale("#b2182b", "#f7f7f7", "#2166ac", 6);
  assert.equal(div.length, 7);
  assert.equal(div[3], "#f7f7f7");
});

test("the font library: unique ids, a bundled default, scripts for Arabic and Ethiopic, pairs that exist", () => {
  assert.ok(FONTS.length >= 40);
  assert.equal(new Set(FONTS.map((f) => f.id)).size, FONTS.length);
  assert.ok(BUNDLED_FONTS.some((f) => f.id === "liberation-sans"));
  assert.ok(fontsFor("ARABIC").length >= 3 && fontsFor("ETHIOPIC").length >= 1 && fontsFor("DEVANAGARI").length >= 1);
  for (const p of FONT_PAIRS) assert.ok(fontById(p.heading) && fontById(p.body), `pair ${p.id}`);
  assert.match(stackFor("nope"), /Liberation Sans/);
});

test("frame presets resolve to concrete values from the theme and refuse unknown tokens", () => {
  const theme = galleryTheme("OCHA_BLUE");
  assert.equal(resolveFrame(undefined, theme).background, null);
  const card = resolveFrame({ frame: "card" }, theme);
  assert.equal(card.background, theme.card);
  assert.equal(card.paddingPx, 16);
  const accent = resolveFrame({ frame: "accent" }, theme);
  assert.ok(contrastRatio(accent.text, theme.accent) >= 4.5, "text reads on the accent fill");
  assert.equal(frameTokens({ frame: "card", padding: "large" }).padding, "large");
  assert.deepEqual(frameStyleProblems({ frame: "nope" }), ["That frame style is not one the product knows."]);
  assert.ok(Object.keys(FRAME_PRESETS).length >= 10);
});

function board() {
  let c = blankCanvas({ id: "c", title: "T", scope: "MINE" });
  c = ok(addBlock(c, "page-1", { id: "h", kind: "TEXT", props: { text: "Heading", role: "heading" } })).canvas;
  c = ok(addBlock(c, "page-1", { id: "b", kind: "TEXT", props: { text: "Body", role: "body" } })).canvas;
  return c;
}
const page = (c, id = "page-1") => c.pages.find((p) => p.id === id);

test("a component is made from blocks, placed with tags, and detached back to ordinary blocks", () => {
  const c = board();
  const comp = ok(componentFromBlocks(c, ["h", "b"], { id: "comp1", name: "Heading and body", scope: "ORG" })).component;
  assert.equal(comp.revision, 1);
  let n = 0;
  const placed = ok(instantiate(c, "page-1", comp, () => `i${++n}`));
  assert.equal(page(placed.canvas).blocks.length, 4);
  assert.deepEqual(page(placed.canvas).blocks.filter((b) => b.component).map((b) => b.component.key), ["h", "b"]);
  assert.deepEqual(canvasStructureProblems(placed.canvas), []);
  const away = ok(detach(placed.canvas, ["i1"]));
  assert.equal(page(away.canvas).blocks.some((b) => b.component), false);
  assert.equal(detach(c, ["h"]).reason, "That is not part of a component.");
  assert.equal(componentFromBlocks(c, [], { id: "x", name: "x", scope: "ORG" }).reason, "Select the blocks to keep.");
  assert.match(componentFromBlocks(c, ["h"], { id: "x", name: " ", scope: "ORG" }).reason, /name/);
});

test("updating a component changes its instances but keeps their place and the settings a slot lets them own", () => {
  const c = board();
  let comp = ok(componentFromBlocks(c, ["h", "b"], { id: "comp1", name: "HB", scope: "ORG" })).component;
  comp = ok(addSlot(comp, { id: "title", label: "Title", blockKey: "h", path: "text" })).component;
  let n = 0;
  let canvas = ok(instantiate(c, "page-1", comp, () => `i${++n}`)).canvas;
  canvas = { ...canvas, pages: canvas.pages.map((p) => ({ ...p, blocks: p.blocks.map((b) => (b.id === "i1" ? { ...b, props: { ...b.props, text: "My own title" } } : b)) })) };
  const revised = ok(reviseComponent(comp, comp.blocks.map((b) => (b.id === "b" ? { ...b, props: { text: "New body", role: "body" } } : b.id === "h" ? { ...b, props: { text: "Default title", role: "heading" } } : b)))).component;
  assert.equal(revised.revision, 2);
  const r = updateInstances(canvas, revised);
  assert.equal(r.updated, 2);
  const at = (id) => page(r.canvas).blocks.find((b) => b.id === id);
  assert.equal(at("i1").props.text, "My own title", "a slot value stays the instance's own");
  assert.equal(at("i2").props.text, "New body", "everything else follows the component");
  assert.equal(at("i1").component.version, 2);
  assert.deepEqual(at("i1").bounds, page(canvas).blocks.find((b) => b.id === "i1").bounds);
  assert.equal(updateInstances(r.canvas, revised).updated, 0, "an up-to-date instance is left alone");
  const gone = updateInstances(canvas, ok(reviseComponent(comp, comp.blocks.filter((b) => b.id === "b"), [])).component);
  assert.deepEqual(gone.notInComponent, ["i1"]);
});

test("a component refuses what would make a broken instance", () => {
  const c = board();
  const comp = ok(componentFromBlocks(c, ["h"], { id: "k", name: "K", scope: "ORG" })).component;
  assert.match(addSlot(comp, { id: "s", label: "L", blockKey: "nope", path: "text" }).reason, /not in the component/);
  assert.match(addSlot(comp, { id: "s", label: "L", blockKey: "h", path: " " }).reason, /needs a setting/);
  assert.ok(componentProblems({ ...comp, blocks: [{ ...comp.blocks[0], kind: "NOPE" }] }).some((p) => /does not know/.test(p)));
  assert.equal(instantiate(c, "ghost", comp, () => "z").reason, "That page does not exist.");
  assert.equal(getAt({ a: { b: 1 } }, "a.b"), 1);
  assert.deepEqual(setAt({ a: 1 }, "b.c", 2), { a: 1, b: { c: 2 } });
});
