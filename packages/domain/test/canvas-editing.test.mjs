import test from "node:test";
import assert from "node:assert/strict";
import * as d from "../dist/index.js";

const base = () => ({ id: "c", scope: "PROJECT", mode: "LIVE", profile: "LIVE_INTERNAL", title: "T", language: "en", themeId: "DEFAULT", revision: 1, pages: [{ id: "p1", title: "One", format: "WEB_FLUID", blocks: [] }] });
const ok = (r) => { assert.equal(r.ok, true, r.reason); return r.canvas; };
const blocks = (c, i = 0) => c.pages[i].blocks;
const noOverlap = (bs) => bs.every((a, i) => bs.every((b, j) => i === j || a.bounds.x >= b.bounds.x + b.bounds.w || b.bounds.x >= a.bounds.x + a.bounds.w || a.bounds.y >= b.bounds.y + b.bounds.h || b.bounds.y >= a.bounds.y + a.bounds.h));

test("the whole catalogue now has definitions", () => assert.deepEqual(d.PENDING_KINDS, []));

test("add, move, resize, duplicate, lock and remove keep a valid canvas with no overlaps", () => {
  let c = base();
  c = ok(d.addBlock(c, "p1", { id: "a", kind: "TEXT" }));
  c = ok(d.addBlock(c, "p1", { id: "b", kind: "CALLOUT" }));
  assert.equal(blocks(c)[1].bounds.y, blocks(c)[0].bounds.h, "a new block goes below the others");
  c = ok(d.resizeBlock(c, "a", 6, 3));
  c = ok(d.resizeBlock(c, "b", 6, 2));
  c = ok(d.moveBlock(c, "b", 6, 0));
  assert.ok(noOverlap(blocks(c)));
  assert.equal(blocks(c).find((x) => x.id === "b").bounds.x, 6);
  assert.equal(d.resizeBlock(c, "a", 20, 3).ok, false);
  assert.equal(d.resizeBlock(c, "a", 6, 99).ok, false);
  assert.equal(d.moveBlock(c, "b", 11, 0).ok, false, "cannot leave the page");
  c = ok(d.duplicateBlock(c, "a", "a2"));
  assert.ok(noOverlap(blocks(c)));
  assert.equal(d.duplicateBlock(c, "a", "a2").ok, false, "ids stay unique");
  c = ok(d.setLocked(c, "a", true));
  assert.equal(d.removeBlock(c, "a").ok, false);
  assert.equal(d.moveBlock(c, "a", 0, 0).ok, false);
  c = ok(d.setLocked(c, "a", false));
  c = ok(d.removeBlock(c, "a"));
  assert.deepEqual(d.canvasProblems(c), []);
});

test("pages: add, move, remove, and move a block between pages", () => {
  let c = ok(d.addPage(base(), { id: "p2", title: "Two" }));
  c = ok(d.addBlock(c, "p1", { id: "a", kind: "DIVIDER" }));
  c = ok(d.moveBlockToPage(c, "a", "p2"));
  assert.equal(blocks(c, 0).length, 0); assert.equal(blocks(c, 1).length, 1);
  c = ok(d.movePage(c, "p2", 0));
  assert.equal(c.pages[0].id, "p2");
  c = ok(d.removePage(c, "p2"));
  assert.equal(d.removePage(c, "p1").ok, false, "the last page stays");
});

test("an unknown block kind and a missing page are refused with a sentence", () => {
  assert.equal(d.addBlock(base(), "p1", { id: "x", kind: "NOPE" }).ok, false);
  assert.equal(d.addBlock(base(), "zz", { id: "x", kind: "TEXT" }).ok, false);
});

test("history: a change is one step, no change is no step, undo and redo walk it, 200 are kept", () => {
  let h = d.startHistory(base());
  const c1 = ok(d.addBlock(h.present, "p1", { id: "a", kind: "TEXT" }));
  h = d.commit(h, c1);
  assert.equal(d.commit(h, structuredClone(c1)), h);
  h = d.commit(h, ok(d.setTitle(h.present, "New")));
  h = d.undo(h); assert.equal(h.present.title, "T");
  h = d.redo(h); assert.equal(h.present.title, "New");
  h = d.undo(d.undo(h)); assert.equal(blocks(h.present).length, 0);
  assert.equal(d.canUndo(h), false);
  let big = d.startHistory(base());
  for (let i = 0; i < d.HISTORY_LIMIT + 10; i += 1) big = d.commit(big, ok(d.setTitle(big.present, `t${i}`)));
  assert.equal(big.past.length, d.HISTORY_LIMIT);
});

test("filters: a block responds only to the dimensions it declares", () => {
  assert.deepEqual(d.honoursOf({ kind: "KPI" }), ["PERIOD", "DRAFTS"]);
  assert.deepEqual(d.honoursOf({ kind: "DIVIDER" }), []);
  const q = { indicatorIds: ["i"], measure: "PERIOD", includeDraft: false };
  assert.deepEqual(d.applyFilters(q, { kind: "KPI" }, { PERIOD: "per1", DRAFTS: true }), { ...q, toPeriodId: "per1", includeDraft: true });
  assert.deepEqual(d.applyFilters(q, { kind: "DIVIDER" }, { PERIOD: "per1", DRAFTS: true }), q);
  let c = ok(d.addBlock(base(), "p1", { id: "k", kind: "KPI" }));
  assert.deepEqual(d.filtersOnPage(c, "p1"), ["PERIOD", "DRAFTS"]);
  assert.deepEqual(d.nextCrossFilter({}, ["PERIOD"], "PERIOD", "x"), { PERIOD: "x" });
  assert.deepEqual(d.nextCrossFilter({ PERIOD: "x" }, ["PERIOD"], "PERIOD", "x"), {});
  assert.deepEqual(d.nextCrossFilter({}, ["PERIOD"], "PLACE", "x"), {}, "a dimension nothing honours is ignored");
});

test("themes: every shipped theme passes the contrast check", () => {
  for (const t of d.listThemes()) assert.deepEqual(d.contrastProblems(t), [], t.id);
});

test("export: every format is described, plans name what is not drawn, csv defuses formulas, outputs are stable", () => {
  assert.equal(Object.keys(d.EXPORT_FORMATS).length, d.EXPORT_FORMAT_IDS.length);
  let c = ok(d.addBlock(base(), "p1", { id: "f", kind: "FILTER_BAR" }));
  c = ok(d.addBlock(c, "p1", { id: "t", kind: "TEXT" }));
  const plan = d.exportPlan(c, "PPTX");
  assert.equal(plan.find((r) => r.blockId === "f").support, "AS_TEXT");
  assert.equal(d.exportPlan(c, "CSV").find((r) => r.blockId === "t").support, "LEFT_OUT");
  assert.ok(d.exportPlan(c, "CSV").every((r) => r.support === "DRAWN" || r.note));
  assert.equal(d.csvCell("=SUM(A1)"), "'=SUM(A1)"); assert.equal(d.csvCell('a,"b"'), '"a,""b"""'); assert.equal(d.csvCell(-5), "-5"); assert.equal(d.csvCell(null), "");
  assert.equal(d.csvOf(["a", "b"], [[1, null]]), "a,b\r\n1,\r\n");
  assert.equal(d.canvasJson(c), d.canvasJson(JSON.parse(JSON.stringify(c))));
  c = ok(d.setBlockAlt(c, "t", "A sentence", "Long"));
  assert.match(d.altPack(c), /Alt: A sentence/);
});

test("templates: roles are filled, unchosen optional roles leave their blocks out, required ones refuse", () => {
  const t = { id: "t", title: "T", description: "", family: "SNAPSHOT", origin: "BUILT_IN", revision: 1,
    roles: [{ key: "MAIN", label: "Main", required: true, accepts: "INDICATOR" }, { key: "SECOND", label: "Second", required: false, accepts: "INDICATOR" }],
    canvas: { profile: "LIVE_INTERNAL", mode: "LIVE", language: "en", themeId: "DEFAULT", pages: [{ id: "p", title: "P", format: "WEB_FLUID", blocks: [
      { id: "k1", kind: "KPI", bounds: { x: 0, y: 0, w: 3, h: 2 }, props: { indicatorId: "{{role:MAIN}}", includeDraft: false }, bindings: [] },
      { id: "k2", kind: "KPI", bounds: { x: 3, y: 0, w: 3, h: 2 }, props: { indicatorId: "{{role:SECOND}}", includeDraft: false }, bindings: [] } ] }] } };
  assert.deepEqual(d.canvasTemplateProblems(t), []);
  assert.deepEqual(d.applyCanvasTemplate(t, {}, { id: "n", title: "N", scope: "PROJECT" }), { ok: false, needs: ["MAIN"] });
  const noProject = d.applyCanvasTemplate(t, { MAIN: "ind-1" }, { id: "n", title: "N", scope: "PROJECT" });
  assert.ok(d.canvasProblems(noProject.canvas).some((p) => /needs something to show/.test(p.message)), "a block that reads a project is not valid until one is chosen");
  const r = d.applyCanvasTemplate(t, { MAIN: "ind-1" }, { id: "n", title: "N", scope: "PROJECT", projectId: "proj-1" });
  assert.equal(r.ok, true); assert.deepEqual(r.leftOut, ["k2"]);
  assert.deepEqual(r.canvas.pages[0].blocks[0].bindings, [{ type: "PROJECT", slot: "project", projectId: "proj-1" }]);
  assert.equal(r.canvas.pages[0].blocks[0].props.indicatorId, "ind-1");
  assert.deepEqual(d.canvasProblems(r.canvas), []);
  const bad = structuredClone(t); bad.canvas.pages[0].blocks[0].props.indicatorId = "{{role:NOPE}}";
  assert.equal(d.canvasTemplateProblems(bad).length, 1);
  const copy = d.copyCanvasTemplate(t, "mine"); assert.equal(copy.basedOn, "t"); assert.equal(t.origin, "BUILT_IN");
});

test("governance: public profiles need alt text and sources, AI drafts must be accepted, blockers stop publish unless waived", () => {
  let c = { ...base(), profile: "DONOR_REPORT" };
  c = ok(d.addBlock(c, "p1", { id: "m", kind: "MAP", props: { view: "RESULTS" } }));
  c = ok(d.addBlock(c, "p1", { id: "s", kind: "AI_SUMMARY" }));
  c = ok(d.setBindings(c, "s", [{ type: "AI_DRAFT", slot: "text", text: "x" }]));
  c = ok(d.addBlock(c, "p1", { id: "n", kind: "BIG_NUMBERS" }));
  c = ok(d.setBindings(c, "n", []));
  const f = d.checkCanvas(c);
  assert.deepEqual([...new Set(f.map((x) => x.ruleId))].sort(), ["AI_NOT_ACCEPTED", "ALT_MISSING"]);
  assert.equal(d.canPublish(f), false);
  assert.equal(d.canPublish(f, new Set(["AI_NOT_ACCEPTED", "ALT_MISSING"])), true);
  c = ok(d.setBlockAlt(c, "m", "A map of results"));
  c = ok(d.setBindings(c, "s", [{ type: "AI_DRAFT", slot: "text", text: "x", acceptedAt: "2026-11-06" }]));
  assert.deepEqual(d.checkCanvas(c), []);
  assert.equal(d.canApplyCanvasAction("DRAFT", "APPROVE"), false);
  assert.equal(d.canApplyCanvasAction("DRAFT", "REQUEST_REVIEW"), true);
  assert.equal(d.checkCanvas({ ...c, profile: "INTERNAL" }).some((x) => x.ruleId === "ALT_MISSING"), false, "internal designs do not need alt text");
});

test("AI: off means hidden, partners never, grounded text keeps only supported figures, translation keeps the numbers", () => {
  const on = { organisationEnabled: true, providerConfigured: true, external: false, overCap: false };
  assert.deepEqual(d.aiGate(on), { allowed: true });
  assert.equal(d.aiGate({ ...on, organisationEnabled: false }).reason, "OFF");
  assert.equal(d.aiGate({ ...on, external: true }).reason, "NOT_FOR_PARTNERS");
  assert.equal(d.aiGate({ ...on, providerConfigured: false }).reason, "NO_PROVIDER");
  assert.equal(d.aiGate({ ...on, overCap: true }).reason, "OVER_CAP");
  const g = d.groundText("We reached 1,200 people. Coverage hit 99 percent. Work continues.", new Set([1200]));
  assert.deepEqual(g.kept, ["We reached 1,200 people.", "Work continues."]); assert.equal(g.dropped.length, 1);
  assert.equal(d.sameFigures("12 centres, 40%", "12 centres, 40 %"), true);
  assert.equal(d.sameFigures("12 centres", "13 centres"), false);
  assert.deepEqual(d.auditShape("secret question", "OK", 2), { length: 15, status: "OK", dropped: 2 });
  const ai = d.definitionFor("AI_SUMMARY");
  assert.equal(ai.resolve({}, {}).state, "empty");
  assert.deepEqual(ai.resolve({}, { text: "t", accepted: false }).notes, ["AI-drafted. Not accepted yet."]);
});

import { BUILT_IN_CANVAS_TEMPLATES, builtInCanvasTemplate, applyCanvasTemplate as applyT, canvasTemplateProblems as templateProblems, canvasStructureProblems, canvasContentProblems, checkCanvas as check, canPublish as publishable, validateChartSpec } from "../dist/index.js";

test("the built-in humanitarian templates: sound, distinct, and every one applies with its roles chosen", () => {
  assert.ok(BUILT_IN_CANVAS_TEMPLATES.length >= 8);
  assert.equal(new Set(BUILT_IN_CANVAS_TEMPLATES.map((t) => t.id)).size, BUILT_IN_CANVAS_TEMPLATES.length);
  for (const t of BUILT_IN_CANVAS_TEMPLATES) {
    assert.deepEqual(templateProblems(t), [], t.id);
    const mapping = Object.fromEntries(t.roles.map((r, i) => [r.key, `ind-${i}`]));
    const r = applyT(t, mapping, { id: "n", title: t.title, scope: "PROJECT", projectId: "p1" });
    assert.equal(r.ok, true, t.id); assert.deepEqual(r.leftOut, [], `${t.id} leaves nothing out when every role is chosen`);
    assert.deepEqual(canvasStructureProblems(r.canvas), [], `${t.id} shape`);
    assert.deepEqual(canvasContentProblems(r.canvas), [], `${t.id} is ready to use, nothing left to set up`);
    for (const b of r.canvas.pages[0].blocks) if (b.kind === "CHART") assert.deepEqual(validateChartSpec(b.props.spec), [], `${t.id} chart`);
  }
});

test("a template with an optional role unchosen leaves out only the blocks that use it; a required one refuses", () => {
  const t = builtInCanvasTemplate("builtin-flash-update");
  assert.equal(applyT(t, {}, { id: "n", title: "x", scope: "MINE" }).ok, false);
  const r = applyT(t, { MAIN: "i1" }, { id: "n", title: "x", scope: "PROJECT", projectId: "p1" });
  assert.deepEqual(r.leftOut.sort(), ["k2", "k3"]);
  assert.deepEqual(canvasStructureProblems(r.canvas), []);
});

test("no template writes the author's words or invents a figure: authored blocks start empty", () => {
  for (const t of BUILT_IN_CANVAS_TEMPLATES) for (const b of t.canvas.pages.flatMap((p) => p.blocks)) {
    if (b.kind === "KEY_MESSAGES") assert.equal(b.props.messages, undefined, t.id);
    if (b.kind === "QUOTE") assert.equal(b.props.text, undefined, t.id);
    if (b.kind === "BANNER") assert.equal(b.props.text, undefined, t.id);
    for (const n of b.props.numbers ?? []) assert.notEqual(n.source, "MANUAL", `${t.id} types no figure`);
  }
});

test("the donor template fails the Design check until a person describes the chart and names the figures' source", () => {
  const t = builtInCanvasTemplate("builtin-donor-one-pager");
  const r = applyT(t, { MAIN: "i1", SECOND: "i2" }, { id: "n", title: "x", scope: "PROJECT", projectId: "p1" });
  const found = check(r.canvas);
  assert.ok(found.some((f) => f.ruleId === "ALT_MISSING" && f.blockId === "trend"));
  assert.equal(publishable(found), false);
});

import { settleBoxes, addBlock as addB, blankCanvas as blank, moveBlock as moveB, canvasStructureProblems as structureProblems } from "../dist/index.js";

test("a one-row block stays one row: the canvas lays out by each block's own limits, not the dashboard's two-cell minimum", () => {
  let c = blank({ id: "c", title: "T", scope: "MINE", format: "WEB_FLUID" });
  for (const [id, kind] of [["d", "DIVIDER"], ["b", "BANNER"], ["f", "FILTER_BAR"], ["t", "TEXT"]]) { const r = addB(c, "page-1", { id, kind }); assert.ok(r.ok, kind); c = r.canvas; }
  assert.deepEqual(c.pages[0].blocks.map((b) => [b.id, b.bounds.h]), [["d", 1], ["b", 1], ["f", 1], ["t", 2]]);
  assert.deepEqual(structureProblems(c), []);
  const moved = moveB(c, "t", 0, 0);
  assert.ok(moved.ok); assert.deepEqual(structureProblems(moved.canvas), [], "moving keeps every block within its limits");
  const rows = moved.canvas.pages[0].blocks.map((b) => [b.bounds.y, b.bounds.y + b.bounds.h]);
  for (const [i, a] of rows.entries()) for (const [j, b] of rows.entries()) if (i < j) assert.ok(a[1] <= b[0] || b[1] <= a[0] || moved.canvas.pages[0].blocks[i].bounds.x + moved.canvas.pages[0].blocks[i].bounds.w <= moved.canvas.pages[0].blocks[j].bounds.x, "no two blocks overlap");
});

test("settling keeps a dropped block where it was put and lets the others fall; nothing leaves the grid", () => {
  const out = settleBoxes([{ id: "a", x: 0, y: 0, w: 6, h: 2 }, { id: "b", x: 3, y: 0, w: 6, h: 2 }, { id: "c", x: 20, y: -4, w: 40, h: 0 }], "b");
  assert.deepEqual(out.find((x) => x.id === "b"), { id: "b", x: 3, y: 0, w: 6, h: 2 });
  assert.equal(out.find((x) => x.id === "a").y, 2, "the other block falls below the pinned one");
  const c = out.find((x) => x.id === "c");
  assert.ok(c.x >= 0 && c.x + c.w <= 12 && c.y >= 0 && c.h >= 1);
  assert.deepEqual(out.map((x) => x.id), ["a", "b", "c"], "the caller's order is kept");
});
