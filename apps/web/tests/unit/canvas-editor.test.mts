import assert from "node:assert/strict";
import test from "node:test";
import { BLOCK_KINDS, definitionFor, canvasProblems, addBlock, blankCanvas, setBindings } from "@donordesk/domain/contexts/canvas/index.js";
import { validateChartSpec } from "@donordesk/domain/contexts/reporting/chart-spec-v2.js";
import { getAt, setAt } from "../../src/features/canvas/domain/path.ts";
import { PROP_FIELDS, afterChange, type Field } from "../../src/features/canvas/domain/prop-fields.ts";
import { seedProps } from "../../src/features/canvas/domain/block-seeds.ts";

test("setting a value inside settings returns a copy and never changes the original", () => {
  const original = { spec: { dataset: { indicatorIds: ["a"], measure: "PERIOD" } }, title: "T" };
  const next = setAt(original, "spec.dataset.indicatorIds", ["a", "b"]);
  assert.deepEqual(getAt(next, "spec.dataset.indicatorIds"), ["a", "b"]);
  assert.deepEqual(original.spec.dataset.indicatorIds, ["a"]);
  assert.equal(getAt(next, "spec.dataset.measure"), "PERIOD", "the rest is kept");
  assert.deepEqual(setAt({}, "a.b.c", 1), { a: { b: { c: 1 } } }, "missing parts are made");
  assert.equal(getAt({ a: 1 }, "a.b.c"), undefined);
});

test("an emptied optional setting is removed, not stored as an empty string", () => {
  assert.deepEqual(setAt({ title: "x", other: 1 }, "title", ""), { other: 1 });
  assert.deepEqual(setAt({ title: "x" }, "title", undefined), {});
  assert.deepEqual(setAt({ flag: true }, "flag", false), { flag: false }, "false is a value");
  assert.deepEqual(setAt({ n: 5 }, "n", 0), { n: 0 }, "0 is a value");
});

test("every field table row belongs to a real block, and every field has a label and a known kind", () => {
  const types = new Set(["text", "textarea", "number", "boolean", "select", "indicator", "indicators", "lines", "list", "choices"]);
  const walk = (fields: ReadonlyArray<Field>, where: string): void => {
    for (const f of fields) {
      assert.ok(types.has(f.type), `${where} ${f.path}`);
      assert.ok(f.label.trim().length > 0 && f.path.length > 0, where);
      if (f.type === "select") { assert.ok(f.options.length > 0, `${where} ${f.path} has options`); assert.equal(new Set(f.options.map((o) => o.value)).size, f.options.length, `${where} ${f.path} options are distinct`); }
      if (f.type === "list") walk(f.item, `${where}.${f.path}`);
    }
  };
  for (const [kind, fields] of Object.entries(PROP_FIELDS)) { assert.ok((BLOCK_KINDS as readonly string[]).includes(kind), kind); walk(fields, kind); }
});

test("every block kind can be added from the palette to an empty page and is a sound canvas", () => {
  for (const kind of BLOCK_KINDS) {
    const c = blankCanvas({ id: "c", title: "T", scope: "MINE" });
    const r = addBlock(c, "page-1", { id: "b1", kind, props: seedProps(kind) });
    assert.equal(r.ok, true, `${kind} can be added`);
    if (!r.ok) continue;
    const withProject = definitionFor(kind)!.slots.some((s) => s.slot === "project") ? setBindings(r.canvas, "b1", [{ type: "PROJECT", slot: "project", projectId: "p1" }]) : r;
    assert.equal(withProject.ok, true);
    if (!withProject.ok) continue;
    const mine = canvasProblems(withProject.canvas);
    // What is reported is only what the person still has to choose (an indicator, a question): never a broken shape.
    assert.ok(mine.every((p) => !/inside the page|not one the product knows|share an id/.test(p.message)), `${kind}: ${mine.map((p) => p.message).join("; ")}`);
    if (definitionFor(kind)!.requiresSetup) assert.ok(mine.length > 0, `${kind} says what to choose`);
    else assert.deepEqual(mine, [], `${kind} is ready as added`);
  }
});

test("choosing indicators for a chart picks the data shape the chart needs, and the result is a valid chart", () => {
  let props: unknown = seedProps("CHART");
  props = afterChange("CHART", setAt(props, "spec.dataset.indicatorIds", ["a"]), "spec.dataset.indicatorIds");
  assert.equal(getAt(props, "spec.dataset.template"), "INDICATOR_OVER_TIME");
  assert.deepEqual(validateChartSpec((props as { spec: never }).spec), []);
  props = afterChange("CHART", setAt(props, "spec.dataset.indicatorIds", ["a", "b"]), "spec.dataset.indicatorIds");
  assert.equal(getAt(props, "spec.dataset.template"), "INDICATORS_OVER_TIME");
  const lineChart = setAt(props, "spec.kind", "LINE");
  assert.deepEqual(validateChartSpec((lineChart as { spec: never }).spec), []);
  assert.equal(afterChange("KPI", { x: 1 }, "x") && true, true, "a block with no follow-up rule is left alone");
});

test("a chart or table with no indicator chosen is told what to do; with one chosen it is ready", () => {
  const c = blankCanvas({ id: "c", title: "T", scope: "MINE" });
  const bind = (cv: never) => { const r = setBindings(cv, "b", [{ type: "PROJECT", slot: "project", projectId: "p" }]); assert.ok(r.ok); return r.ok ? r.canvas : cv; };
  for (const [kind, path] of [["CHART", "spec.dataset.indicatorIds"], ["TABLE", "query.indicatorIds"]] as const) {
    const empty = addBlock(c, "page-1", { id: "b", kind, props: seedProps(kind) });
    assert.ok(empty.ok);
    assert.ok(empty.ok && canvasProblems(bind(empty.canvas as never)).length > 0, `${kind} asks for an indicator`);
    const filled = addBlock(c, "page-1", { id: "b", kind, props: afterChange(kind, setAt(seedProps(kind), path, ["a"]), path) });
    assert.ok(filled.ok);
    assert.deepEqual(filled.ok ? canvasProblems(bind(filled.canvas as never)) : [], [], `${kind} is ready once an indicator is chosen`);
  }
});
