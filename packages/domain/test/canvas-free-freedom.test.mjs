import test from "node:test";
import assert from "node:assert/strict";
import * as d from "../dist/index.js";

const free = () => d.blankCanvas({ id: "c", title: "T", scope: "MINE" });
const ok = (r) => { assert.equal(r.ok, true, r.reason); return r.canvas; };

test("a new canvas is a free page of the default dashboard size", () => {
  const c = free();
  assert.equal(c.pages[0].mode, "FREE");
  assert.equal(c.pages[0].format, d.DEFAULT_PAGE_FORMAT);
  assert.deepEqual(c.pages[0].size, { w: 1280, h: 800 });
});

test("a block added to a free page gets a pixel frame below the others, and nothing is pushed around", () => {
  let c = free();
  c = ok(d.addBlock(c, c.pages[0].id, { id: "a", kind: "TEXT" }));
  c = ok(d.addBlock(c, c.pages[0].id, { id: "b", kind: "CALLOUT" }));
  const [a, b] = c.pages[0].blocks;
  assert.ok(a.free && b.free);
  assert.ok(b.free.y >= a.free.y + a.free.h, "b sits below a");
  c = ok(d.setFrame(c, "a", { x: 500, y: 300, w: 333, h: 211 }));
  const moved = c.pages[0].blocks.find((x) => x.id === "a");
  assert.deepEqual([moved.free.x, moved.free.y, moved.free.w, moved.free.h], [500, 300, 333, 211]);
  assert.equal(c.pages[0].blocks.find((x) => x.id === "b").free.y, b.free.y, "another block did not move");
});

test("any size from the floor up is allowed on a free page; a locked block is refused", () => {
  let c = free();
  c = ok(d.addBlock(c, c.pages[0].id, { id: "a", kind: "KPI" }));
  c = ok(d.setFrame(c, "a", { w: d.FREE_MIN_PX, h: d.FREE_MIN_PX }));
  const f = c.pages[0].blocks[0].free;
  assert.equal(f.w, d.FREE_MIN_PX);
  c = ok(d.setFrame(c, "a", { w: 3000, h: 40 }));
  assert.equal(c.pages[0].blocks[0].free.w, 3000);
  c = ok(d.setLocked(c, "a", true));
  assert.equal(d.setFrame(c, "a", { x: 5 }).ok, false);
});

test("moving a free block keeps its grid cells in step so the page can go back to a grid", () => {
  let c = free();
  c = ok(d.addBlock(c, c.pages[0].id, { id: "a", kind: "TEXT" }));
  c = ok(d.setFrame(c, "a", { x: 24 + 6 * 100, y: 24 }));
  const b = c.pages[0].blocks[0];
  assert.ok(b.bounds.x >= 5 && b.bounds.x <= 7);
});

test("align, distribute and match size work on pixel frames", () => {
  let c = free();
  for (const id of ["a", "b", "c"]) c = ok(d.addBlock(c, c.pages[0].id, { id, kind: "TEXT" }));
  c = ok(d.setFrame(c, "a", { x: 10, y: 10, w: 100, h: 50 }));
  c = ok(d.setFrame(c, "b", { x: 200, y: 90, w: 120, h: 60 }));
  c = ok(d.setFrame(c, "c", { x: 500, y: 20, w: 80, h: 40 }));
  const r = d.align(c, ["a", "b", "c"], "TOP");
  assert.equal(r.ok, true);
  assert.deepEqual(r.canvas.pages[0].blocks.map((b) => b.free.y), [10, 10, 10]);
  const dist = d.distribute(r.canvas, ["a", "b", "c"], "HORIZONTAL");
  assert.equal(dist.ok, true);
  const xs = dist.canvas.pages[0].blocks.map((b) => b.free);
  const gap1 = xs[1].x - (xs[0].x + xs[0].w), gap2 = xs[2].x - (xs[1].x + xs[1].w);
  assert.ok(Math.abs(gap1 - gap2) <= 1);
  const m = d.matchSize(c, ["a", "b", "c"], "a", "BOTH");
  assert.equal(m.ok, true);
  assert.ok(m.canvas.pages[0].blocks.every((b) => b.free.w === 100 && b.free.h === 50));
});

test("nudging a free block moves it in pixel steps", () => {
  let c = free();
  c = ok(d.addBlock(c, c.pages[0].id, { id: "a", kind: "TEXT" }));
  const before = c.pages[0].blocks[0].free.x;
  const r = d.nudge(c, ["a"], "RIGHT");
  assert.equal(r.ok, true);
  assert.equal(r.canvas.pages[0].blocks[0].free.x, before + 8);
});

test("text overrides replace the automatic words, reset restores them, wrapping never drops text", () => {
  const f = d.withText(undefined, "title", "My headline");
  assert.equal(d.resolveText("title", "Auto", f).value, "My headline");
  assert.equal(d.resolveText("title", "Auto", f).origin, "EDITED");
  assert.equal(d.resolveText("title", "Auto", d.withText(f, "title", "")).value, "Auto");
  assert.equal(d.withText(f, "title", undefined), undefined, "an empty format is removed");
  const lines = d.wrapText("Number of people reached with multi-cluster assistance in the lean season", 120, (s) => s.length * 6);
  assert.ok(lines.length > 1);
  assert.equal(lines.join(" "), "Number of people reached with multi-cluster assistance in the lean season");
  assert.ok(lines.every((l) => !l.includes("…")));
  const long = d.wrapText("Supercalifragilisticexpialidocious", 60, (s) => s.length * 6);
  assert.equal(long.join(""), "Supercalifragilisticexpialidocious", "an over-long word is split, never cut");
});

test("an edited text that states a figure the block does not hold is named", () => {
  assert.deepEqual(d.unbackedFigures("About 1,200 people reached", "Reached"), ["1200"]);
  assert.deepEqual(d.unbackedFigures("1,200 reached", "1200 people reached"), []);
});

test("typography and texts are formatting capabilities every ordinary block offers, and are checked", () => {
  assert.ok(d.formatsOf("KPI").includes("typography") && d.formatsOf("KPI").includes("texts"));
  assert.deepEqual(d.formatProblems("KPI", { typography: { sizePx: 120, fontId: "liberation-sans", weight: "700" } }), []);
  assert.ok(d.formatProblems("KPI", { typography: { sizePx: 2 } }).length > 0);
  assert.ok(d.formatProblems("KPI", { typography: { fontId: "no-such-font" } }).length > 0);
  assert.ok(d.formatProblems("KPI", { texts: { nope: "x" } }).length > 0);
});

test("a theme is enforced: applying one clears overrides unless a block is marked to keep its colours", () => {
  let c = free();
  c = ok(d.addBlock(c, c.pages[0].id, { id: "a", kind: "CHART", props: { spec: { version: 2, kind: "BAR", colors: ["#ff0000"], dataset: { template: "INDICATOR_OVER_TIME", indicatorIds: [] } } } }));
  c = ok(d.addBlock(c, c.pages[0].id, { id: "b", kind: "TEXT" }));
  c = { ...c, pages: c.pages.map((p) => ({ ...p, blocks: p.blocks.map((b) => (b.id === "b" ? { ...b, format: { title: { color: { hex: "#112233" } }, typography: { fontId: "liberation-sans", sizePx: 30 } } } : b)) })) };
  assert.equal(d.themeConformance(c).length, 2);
  const next = d.applyTheme(c, "OCEAN");
  assert.equal(next.themeId, "OCEAN");
  assert.equal(d.themeConformance(next).length, 0);
  assert.equal(next.pages[0].blocks[1].format.typography.sizePx, 30, "sizes are the person's and stay");
  const kept = d.applyTheme(d.keepOwnColours(c, "a", true), "OCEAN");
  assert.deepEqual(d.themeConformance(kept).map((x) => x.blockId), ["a"]);
});

test("the flat title bar is a frame style with a coloured bar that reads", () => {
  assert.ok(d.FRAME_PRESETS.flatBar.tokens.titleBar === "accent");
  const theme = d.themeById ? d.themeById("DEFAULT") : null;
  if (theme) {
    const r = d.resolveFrame({ frame: "flatBar" }, theme);
    assert.ok(r.titleBar && /^#/.test(r.titleBar.background));
    assert.equal(r.shadow, "none");
  }
  assert.deepEqual(d.frameStyleProblems({ titleBar: "accent" }), []);
  assert.ok(d.frameStyleProblems({ titleBar: "pink" }).length > 0);
});

test("every drawable chart kind is offered, and a kind the data cannot show reshapes the data instead of hiding", () => {
  const spec = { version: 2, kind: "BAR", dataset: { template: "INDICATOR_OVER_TIME", indicatorIds: ["a"], measure: "PERIOD", showTarget: false, includeDraft: false } };
  const kinds = d.pickableKinds();
  assert.ok(kinds.includes("PIE") && kinds.includes("DONUT") && kinds.includes("TREEMAP"));
  const pie = d.reshapeForKind(spec, "PIE", ["a", "b", "c"]);
  assert.equal(pie.ok, true);
  assert.equal(pie.spec.kind, "PIE");
  assert.notEqual(pie.spec.dataset.template, "INDICATOR_OVER_TIME");
  assert.ok(pie.note && /latest|share|status|place|plan|budget|latest/i.test(pie.note) || pie.note);
  for (const k of kinds) { const r = d.reshapeForKind(spec, k, ["a", "b", "c", "d", "e", "f"]); assert.equal(r.ok, true, `${k} is offered and reshapes`); assert.equal(r.spec.kind, k); }
  const planned = d.reshapeForKind(spec, "POPULATION_PYRAMID", ["a"]);
  assert.equal(planned.ok, false);
  assert.ok(planned.reason.length > 10);
});

test("empty row bands are closed when a starter leaves blocks out, and a taller-than-the-page starter is accepted", () => {
  const boxes = [{ id: "a", x: 0, y: 0, w: 6, h: 2 }, { id: "b", x: 0, y: 5, w: 6, h: 2 }, { id: "c", x: 6, y: 5, w: 6, h: 3 }, { id: "d", x: 0, y: 12, w: 12, h: 1 }];
  const out = d.compactRows(boxes);
  assert.deepEqual(out.map((b) => b.y), [0, 2, 2, 5]);
  assert.deepEqual(out.map((b) => b.h), [2, 2, 3, 1]);
  // A block far below an A4 page is on the page for validation (the page grows, a file paginates).
  const a4 = d.blankCanvas({ id: "c", title: "T", scope: "MINE", format: "A4_PORTRAIT" });
  let c = ok(d.addBlock(a4, a4.pages[0].id, { id: "x", kind: "TEXT" }));
  c = ok(d.setFrame(c, "x", { y: 3000 }));
  assert.deepEqual(d.canvasStructureProblems(c), []);
  assert.ok(d.pageExtent(c.pages[0]).h > 3000);
});

test("value labels reach every chart kind that can carry them, are templates a file can keep, and never touch self-labelled kinds", async () => {
  const { CASES, build, spec } = await import("./support/chart-fixtures.mjs");
  const labelled = (b) => (b.option.series ?? []).filter((s) => s.label?.show === true || (Array.isArray(s.data) && s.data.some((x) => x && x.label && x.label.show === true)));
  const mustLabel = ["BAR", "BAR_HORIZONTAL", "BAR_GROUPED", "BAR_STACKED", "LINE", "AREA", "HISTOGRAM", "SCATTER", "BUBBLE", "WATERFALL", "LOLLIPOP", "TREEMAP", "SUNBURST", "CHOROPLETH", "SANKEY", "DUMBBELL", "BAR_LINE_COMBO"];
  const missing = [];
  for (const k of mustLabel) {
    const [t, ids] = CASES[k];
    const b = build(spec(k, t, ids, { labels: { show: true, format: "VALUE" } }));
    if (!b.ok) { missing.push(`${k} (not built)`); continue; }
    const hasEdge = (b.option.series ?? []).some((s) => s.edgeLabel?.show === true);
    if (labelled(b).length === 0 && !hasEdge) missing.push(k);
  }
  assert.deepEqual(missing, [], "these kinds ignore the labels setting");
  // Off by default for kinds that were off; a kind that writes its own figure is not given a second one.
  const off = build(spec("HISTOGRAM", ...CASES.HISTOGRAM.slice(0, 2)));
  assert.equal(labelled(off).length, 0);
  for (const k of ["GAUGE", "WAFFLE", "RADAR", "BOX_PLOT"]) {
    const [t, ids] = CASES[k];
    const before = build(spec(k, t, ids)), after = build(spec(k, t, ids, { labels: { show: true, format: "VALUE" } }));
    if (before.ok && after.ok && before.option) assert.deepEqual(JSON.stringify(after.option.series), JSON.stringify(before.option.series), `${k} is left alone`);
  }
  // A full-figure label is a plain template (survives an export that clones the option as data); name and value too.
  const [t, ids] = CASES.HISTOGRAM;
  const s1 = build(spec("HISTOGRAM", t, ids, { labels: { show: true, format: "NAME_VALUE" } })).option.series[0].label;
  assert.equal(s1.formatter, "{b}: {c}");
  // A position the style names reaches the new labels.
  const pos = build(spec("HISTOGRAM", t, ids, { labels: { show: true, format: "VALUE" }, style: { labels: { position: "TOP" } } })).option.series[0].label;
  assert.equal(pos.position, "top");
});

test("a block's Labels formatting reaches its chart; the chart's own settings win", () => {
  const chart = { version: 2, kind: "BAR", dataset: { template: "INDICATOR_OVER_TIME", indicatorIds: ["a"], measure: "PERIOD", showTarget: false, includeDraft: false } };
  const withFormat = d.specWithFormatLabels(chart, { show: true, position: "outside", size: "L", density: "auto" });
  assert.equal(withFormat.labels.show, true);
  assert.equal(withFormat.style.labels.position, "OUTSIDE");
  assert.equal(withFormat.style.labels.size, 14);
  assert.equal(d.specWithFormatLabels({ ...chart, labels: { show: false, format: "NAME" } }, { show: true }).labels.show, false, "the chart's own choice wins");
  assert.equal(d.specWithFormatLabels(chart, { density: "none" }).labels.show, false);
});
