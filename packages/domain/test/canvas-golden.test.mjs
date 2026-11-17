import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import {
  BUILT_IN_CANVAS_TEMPLATES, INFOGRAPHIC_TEMPLATES, addBlock, applyCanvasTemplate, setContainer, blankCanvas, canvasAsDesign, canvasStructureProblems,
  definitionFor, legacyDashboardToCanvas, legacyInfographicToCanvas,
} from "../dist/index.js";

/**
 * Phase 48.0 golden documents. Every canvas the product can already make (the built-in starter templates, every converted
 * infographic template, a converted dashboard and a canvas with containers) must keep reading and printing the same through
 * every later Phase 48 batch. Each document is pinned by a hash of its stored form and of the design a file would draw
 * (what a file holds and what it names as skipped). A change that is intended refreshes the hashes with `UPDATE_GOLDEN=1`
 * and says so in the pull request; an accidental one fails here.
 */
const FILE = new URL("./golden/canvas-hashes.json", import.meta.url);
const stable = (v) => JSON.stringify(v, (_k, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : 1))) : x));
const hash = (v) => createHash("sha256").update(stable(v)).digest("hex").slice(0, 16);

function documents() {
  const docs = new Map();
  for (const t of BUILT_IN_CANVAS_TEMPLATES) {
    const mapping = Object.fromEntries(t.roles.map((r) => [r.key, r.accepts === "PLACE" ? "place-1" : r.accepts === "TEXT" ? "A line of words" : `ind-${r.key.toLowerCase()}`]));
    const applied = applyCanvasTemplate(t, mapping, { id: `golden-${t.id}`, title: t.title, scope: "PROJECT", projectId: "project-1" });
    assert.ok(applied.ok, `template ${t.id} should apply with every role chosen`);
    docs.set(`template:${t.id}`, applied.canvas);
  }
  for (const t of Object.values(INFOGRAPHIC_TEMPLATES)) {
    const { canvas } = legacyInfographicToCanvas({ id: `golden-${t.id}`, title: t.label, config: { format: "A4_PORTRAIT", sections: t.sections }, revision: 1, projectScope: true });
    docs.set(`infographic:${t.id}`, canvas);
  }
  const widgets = [
    { id: "w1", projectId: "project-1", kind: "TEXT", text: "Notes", x: 0, y: 0, w: 12, h: 1 },
    { id: "w2", projectId: "project-1", kind: "KPI", kpi: { indicatorId: "ind-a", includeDraft: false }, x: 0, y: 1, w: 3, h: 2 },
    { id: "w3", projectId: "project-1", kind: "METRIC", metric: { metric: "ACTIVITIES_TOTAL" }, x: 3, y: 1, w: 3, h: 2 },
    { id: "w4", projectId: "project-1", kind: "MAP", map: { view: "ACTIVITIES" }, x: 6, y: 1, w: 6, h: 4 },
  ];
  docs.set("dashboard:mixed", legacyDashboardToCanvas({ id: "golden-dashboard", title: "Mixed dashboard", scope: "PROJECT", revision: 1, widgets }).canvas);
  const ok = (r) => { assert.equal(r.ok, true, r.ok ? "" : r.reason); return r.canvas; };
  let withContainers = blankCanvas({ id: "golden-containers", title: "Containers", scope: "PROJECT", format: "WEB_FLUID" });
  const pageId = withContainers.pages[0].id;
  withContainers = ok(addBlock(withContainers, pageId, { id: "tabs", kind: "TABS" }));
  withContainers = ok(addBlock(withContainers, pageId, { id: "t1", kind: "TEXT", props: { text: "Inside the first tab" } }));
  withContainers = ok(addBlock(withContainers, pageId, { id: "t2", kind: "TEXT", props: { text: "Inside the second tab" } }));
  withContainers = ok(addBlock(withContainers, pageId, { id: "div", kind: "DIVIDER" }));
  withContainers = ok(setContainer(withContainers, "t1", { id: "tabs", tab: 0 }));
  withContainers = ok(setContainer(withContainers, "t2", { id: "tabs", tab: 1 }));
  docs.set("canvas:containers", withContainers);
  return docs;
}

const docs = documents();
const current = Object.fromEntries([...docs].map(([id, canvas]) => {
  const design = canvasAsDesign(canvas, "project-1");
  return [id, { canvas: hash(canvas), design: hash({ config: design.config, skipped: design.skipped }) }];
}));

test("the golden set covers every starter template, every infographic template, a dashboard and containers", () => {
  assert.equal([...docs.keys()].filter((k) => k.startsWith("template:")).length, BUILT_IN_CANVAS_TEMPLATES.length);
  assert.equal([...docs.keys()].filter((k) => k.startsWith("infographic:")).length, Object.keys(INFOGRAPHIC_TEMPLATES).length);
  assert.ok(docs.has("dashboard:mixed") && docs.has("canvas:containers"));
});

test("every golden document has a sound structure and only blocks the registry knows", () => {
  for (const [id, canvas] of docs) {
    assert.deepEqual(canvasStructureProblems(canvas), [], `${id} has structural problems`);
    for (const page of canvas.pages) for (const block of page.blocks) assert.ok(definitionFor(block.kind), `${id}: block kind ${block.kind} has no definition`);
  }
});

test("every golden document still reads and prints exactly as pinned", () => {
  if (process.env.UPDATE_GOLDEN === "1") { writeFileSync(FILE, `${JSON.stringify(current, null, 2)}\n`); return; }
  assert.ok(existsSync(FILE), "golden/canvas-hashes.json is missing: run UPDATE_GOLDEN=1 once and commit it");
  const pinned = JSON.parse(readFileSync(FILE, "utf8"));
  assert.deepEqual(Object.keys(pinned).sort(), Object.keys(current).sort(), "the set of golden documents changed");
  for (const id of Object.keys(current)) {
    assert.equal(current[id].canvas, pinned[id].canvas, `${id}: the stored document changed (intended? refresh with UPDATE_GOLDEN=1)`);
    assert.equal(current[id].design, pinned[id].design, `${id}: what a file would draw changed (intended? refresh with UPDATE_GOLDEN=1)`);
  }
});
