import test from "node:test";
import assert from "node:assert/strict";
import { BLOCK_KINDS, PORTED_KINDS, PENDING_KINDS, canvasProblems, bindingProblems, definitionFor, manualWithoutSource, unacceptedDrafts } from "../dist/index.js";

const block = (id, kind, props, over = {}) => ({ id, kind, bounds: { x: 0, y: 0, w: 6, h: 2 }, props, bindings: [], ...over });
const canvas = (blocks, over = {}) => ({ id: "c1", scope: "PROJECT", mode: "LIVE", profile: "LIVE_INTERNAL", title: "Test", language: "en", themeId: "default", revision: 1, pages: [{ id: "p1", title: "One", format: "WEB_FLUID", blocks }], ...over });

test("the catalogue has no duplicates and the ported plus pending kinds are exactly the catalogue", () => {
  assert.equal(new Set(BLOCK_KINDS).size, BLOCK_KINDS.length);
  assert.deepEqual([...PORTED_KINDS, ...PENDING_KINDS].sort(), [...BLOCK_KINDS].sort());
});

test("every ported block honours the contract (defaults validate, sizes sane, slots named once)", () => {
  for (const kind of PORTED_KINDS) {
    const def = definitionFor(kind);
    assert.equal(def.kind, kind);
    assert.ok(def.labelKey.startsWith("canvas.block."), kind);
    const found = def.validate(def.defaults());
    if (def.requiresSetup) assert.ok(found.length > 0 && found.every((p) => p.message.length > 5), `${kind} asks for a choice in a sentence`);
    else assert.deepEqual(found, [], `${kind} defaults must be valid`);
    const { min, max, default: d } = def.sizes;
    assert.ok(min.w <= d.w && d.w <= max.w && min.h <= d.h && d.h <= max.h, `${kind} default size inside its limits`);
    assert.ok(max.w <= 12);
    assert.equal(new Set(def.slots.map((s) => s.slot)).size, def.slots.length);
    if (!def.requiresSetup) assert.ok(["ready", "empty", "unavailable"].includes(def.resolve(def.defaults(), undefined).state));
  }
});

test("a valid canvas has no problems; an unknown block, bad bounds and duplicates are named", () => {
  assert.deepEqual(canvasProblems(canvas([block("a", "TEXT", { text: "Hi", role: "body" })])), []);
  const bad = canvas([block("a", "NOPE", {}), block("b", "TEXT", { text: "x", role: "body" }, { bounds: { x: 10, y: 0, w: 6, h: 2 } }), block("b", "DIVIDER", { line: true }, { bounds: { x: 0, y: 3, w: 12, h: 1 } })]);
  const messages = canvasProblems(bad).map((p) => p.message);
  assert.ok(messages.some((m) => /not one the product knows/.test(m)));
  assert.ok(messages.some((m) => /inside the page/.test(m)));
  assert.ok(messages.some((m) => /share an id/.test(m)));
});

test("an empty text block says it is empty, never a placeholder", () => {
  assert.deepEqual(definitionFor("TEXT").resolve({ text: "  ", role: "body" }), { state: "empty", reason: "Nothing written yet." });
});

test("bindings are checked against the block's slots", () => {
  const slots = [{ slot: "main", accepts: ["MANUAL"], min: 1, max: 1, honours: [] }];
  assert.equal(bindingProblems(slots, []).length, 1);
  assert.equal(bindingProblems(slots, [{ type: "MANUAL", slot: "main", value: "" }]).length, 1);
  assert.equal(bindingProblems(slots, [{ type: "MANUAL", slot: "other", value: "5" }]).length, 2);
  assert.deepEqual(bindingProblems(slots, [{ type: "MANUAL", slot: "main", value: "5" }]), []);
  assert.equal(manualWithoutSource([{ type: "MANUAL", slot: "main", value: "5" }]).length, 1);
  assert.equal(unacceptedDrafts([{ type: "AI_DRAFT", slot: "s", text: "t" }, { type: "AI_DRAFT", slot: "s", text: "t", acceptedAt: "2026-11-06" }]).length, 1);
});

import { legacyDashboardToCanvas, legacyProjectIds, widgetProblems } from "../dist/index.js";

test("a stored dashboard reads as a canvas: every widget kind maps, tabs become pages, positions carry over, nothing is dropped silently", () => {
  const w = (id, over) => ({ id, projectId: "p1", x: 0, y: 0, w: 6, h: 4, ...over });
  const widgets = [
    w("t", { kind: "TEXT", text: "# Title" }),
    w("k", { kind: "KPI", kpi: { indicatorId: "i1", includeDraft: false } }),
    w("m", { kind: "METRIC", metric: { metric: "ACTIVITIES_DONE" } }),
    w("mp", { kind: "MAP", map: { view: "RESULTS" }, tab: "Maps" }),
    w("r", { kind: "REPORT", report: { indicatorIds: ["i1"], measure: "PERIOD", rows: "INDICATOR", includeDraft: false }, text: "T" }),
    w("pl", { kind: "PROJECT_LIST", projectList: { affiliation: "ALL" } }),
    w("c", { spec: { template: "INDICATOR_OVER_TIME", indicatorIds: ["i1"], measure: "PERIOD", type: "BAR", showTarget: false } }),
    w("bad", { kind: "KPI" }),
  ];
  assert.deepEqual(widgetProblems(widgets.slice(0, 7)).filter((p) => p.widgetId !== "r"), []);
  const { canvas, unreadable } = legacyDashboardToCanvas({ id: "d", title: "D", scope: "PROJECT", revision: 3, widgets });
  assert.deepEqual(unreadable.map((u) => u.widgetId), ["bad"]);
  assert.deepEqual(canvas.pages.map((p) => p.title), ["Overview", "Maps"]);
  const kinds = canvas.pages.flatMap((p) => p.blocks).map((b) => [b.id, b.kind]);
  assert.deepEqual(kinds, [["t", "TEXT"], ["k", "KPI"], ["m", "METRIC"], ["r", "TABLE"], ["pl", "PROJECT_LIST"], ["c", "CHART"], ["mp", "MAP"]]);
  assert.equal(canvas.pages[0].blocks[0].props.role, "heading");
  assert.deepEqual(canvas.pages[0].blocks[1].bounds, { x: 0, y: 0, w: 6, h: 4 });
  assert.equal(legacyProjectIds(widgets).k, "p1");
  assert.equal(canvas.pages[0].blocks.at(-1).props.spec.version, 2, "a v1 chart is lifted to v2");
});

import { legacyInfographicToCanvas } from "../dist/index.js";
import * as dom from "../dist/index.js";

test("a stored infographic reads as a canvas: widths and order become cells, page breaks become pages, losses are named", () => {
  const config = { templateId: "CUSTOM", templateVersion: 1, format: "A4_PORTRAIT", profile: "DONOR_REPORT", sections: [
    { kind: "HERO", span: 12, title: "Hello" },
    { kind: "KPIS", span: 12, indicatorIds: ["a", "b"] },
    { kind: "KEY_MESSAGES", span: 6, messages: [{ text: "One" }] },
    { kind: "QUOTE", span: 6, text: "q", attribution: "Someone" },
    { kind: "TEXT", span: 12, text: "Body", pageBreakBefore: true, hidden: true },
    { kind: "MAP", span: 12, mapMetric: "REACH" },
    { kind: "NOPE", span: 12 },
  ] };
  const { canvas, unreadable, losses } = legacyInfographicToCanvas({ id: "i", title: "I", config, revision: 2 });
  assert.equal(canvas.mode, "PUBLISHED_ONLY");
  assert.equal(canvas.profile, "DONOR_REPORT");
  assert.equal(canvas.pages.length, 2);
  assert.deepEqual(unreadable.map((u) => u.index), [6]);
  assert.deepEqual(losses, [], "nothing is lost: the map keeps its shading");
  assert.deepEqual(canvas.pages[1].blocks[1].props, { view: "RESULTS", shading: "REACH" });
  const [a, b, c, d] = canvas.pages[0].blocks;
  assert.deepEqual([a.kind, b.kind, c.kind, d.kind], ["HERO", "BIG_NUMBERS", "KEY_MESSAGES", "QUOTE"]);
  assert.deepEqual([c.bounds.x, d.bounds.x, c.bounds.y === d.bounds.y], [0, 6, true], "two half-width blocks share a row");
  assert.equal(canvas.pages[1].blocks[0].style.hidden, true);
  assert.equal(dom.canvasProblems(canvas).filter((p) => p.blockId === "s3").length, 0);
});

test("a long key-figures row becomes several rows of figures, none cut", () => {
  const ids = Array.from({ length: 14 }, (_, i) => `ind-${i}`);
  const config = { templateId: "CUSTOM", templateVersion: 1, sections: [{ kind: "KPIS", span: 12, indicatorIds: ids }] };
  const { canvas, losses } = legacyInfographicToCanvas({ id: "i", title: "I", config, revision: 1 });
  const blocks = canvas.pages[0].blocks;
  assert.deepEqual(losses, []);
  assert.deepEqual(blocks.map((b) => b.kind), ["BIG_NUMBERS", "BIG_NUMBERS", "BIG_NUMBERS"]);
  assert.deepEqual(blocks.map((b) => b.props.numbers.length), [6, 6, 2]);
  assert.deepEqual(blocks.flatMap((b) => b.props.numbers.map((n) => n.indicatorId)), ids);
  assert.deepEqual(new Set(blocks.map((b) => b.id)).size, 3, "each part has its own id");
  assert.deepEqual(blocks.map((b) => b.bounds.y).sort((a, b) => a - b), [0, 2, 4], "the rows stack, they do not overlap");
});

test("a converted dashboard block names the project it reads as a binding, and the list of projects needs none", () => {
  const w = (id, over) => ({ id, projectId: "proj-9", x: 0, y: 0, w: 6, h: 4, ...over });
  const { canvas } = dom.legacyDashboardToCanvas({ id: "d", title: "D", scope: "PROJECT", revision: 1, widgets: [
    w("k", { kind: "KPI", kpi: { indicatorId: "i1", includeDraft: false } }),
    w("m", { kind: "MAP", map: { view: "ACTIVITIES" } }),
    w("t", { kind: "TEXT", text: "Hi" }),
    w("l", { kind: "PROJECT_LIST", projectList: { affiliation: "ALL" } }),
  ] });
  const byId = Object.fromEntries(canvas.pages[0].blocks.map((b) => [b.id, b]));
  assert.deepEqual(byId.k.bindings, [{ type: "PROJECT", slot: "project", projectId: "proj-9" }]);
  assert.deepEqual(byId.m.bindings, [{ type: "PROJECT", slot: "project", projectId: "proj-9" }]);
  assert.deepEqual(byId.t.bindings, []);
  assert.deepEqual(byId.l.bindings, []);
  assert.equal(dom.projectOf(byId.k.bindings), "proj-9");
  assert.deepEqual(dom.canvasProblems(canvas), [], "a converted dashboard is a valid canvas");
});
