import test from "node:test";
import assert from "node:assert/strict";
import { BUILT_IN_CANVAS_TEMPLATES, LIBRARY_CANVAS_TEMPLATES, canvasTemplateProblems, applyCanvasTemplate } from "../dist/index.js";

test("the starter library holds well over a hundred layouts, each valid, with unique ids and only its own roles", () => {
  assert.ok(BUILT_IN_CANVAS_TEMPLATES.length >= 120, `found ${BUILT_IN_CANVAS_TEMPLATES.length}`);
  assert.equal(new Set(BUILT_IN_CANVAS_TEMPLATES.map((t) => t.id)).size, BUILT_IN_CANVAS_TEMPLATES.length);
  for (const t of LIBRARY_CANVAS_TEMPLATES) assert.deepEqual(canvasTemplateProblems(t), [], t.id);
});

test("every sector with a results canvas also has a donor page, a flash update, a monitoring page, a people page and a where-we-work page", () => {
  const ids = new Set(BUILT_IN_CANVAS_TEMPLATES.map((t) => t.id));
  const results = BUILT_IN_CANVAS_TEMPLATES.filter((t) => t.id.startsWith("lib-canvas-") && !/-(donor|flash|monitoring|people|where)$/.test(t.id));
  assert.ok(results.length >= 25);
  for (const t of results) for (const kind of ["donor", "flash", "monitoring", "people", "where"]) assert.ok(ids.has(`${t.id}-${kind}`), `${t.id}-${kind}`);
});

test("a variant applied with nothing chosen asks for the headline indicator and draws nothing from a guess", () => {
  const t = BUILT_IN_CANVAS_TEMPLATES.find((x) => x.id.endsWith("-flash") && x.id.startsWith("lib-canvas-"));
  const r = applyCanvasTemplate(t, {}, { id: "c1", title: "x", scope: "MINE", projectId: "p" });
  assert.equal(r.ok, false);
  assert.ok(r.needs.length >= 1);
});
