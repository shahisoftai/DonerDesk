import test from "node:test";
import assert from "node:assert/strict";
import { isInAppAddress, parameterProblems, paramBindingProblems, effectiveValues, filterFor, isValueOfKind, targetFor, actionProblems, runAction, blankCanvas, addBlock, canvasStructureProblems, PARAMETER_KINDS } from "../dist/index.js";

const period = { id: "period", label: "Period", kind: "PERIOD", allowed: ["p1", "p2"], default: "p2" };
const places = { id: "places", label: "Places", kind: "PLACE", multiple: true };

test("parameters are checked: names, kinds, defaults, offered values and pages", () => {
  assert.deepEqual(parameterProblems([period, places]), []);
  assert.match(parameterProblems([{ ...period, id: "1bad" }])[0].message, /name is 1 to 30/);
  assert.ok(parameterProblems([period, period]).some((p) => /share a name/.test(p.message)));
  assert.ok(parameterProblems([{ ...period, default: "p9" }]).some((p) => /not one of the offered/.test(p.message)));
  assert.ok(parameterProblems([{ ...period, multiple: true }]).some((p) => /takes one value/.test(p.message)));
  assert.ok(parameterProblems([{ id: "r", label: "R", kind: "PERIOD_RANGE", allowed: ["a"] }]).some((p) => /no list of values/.test(p.message)));
  assert.ok(parameterProblems([{ ...period, pageId: "nope" }], new Set(["page-1"])).some((p) => /page that does not exist/.test(p.message)));
  assert.ok(parameterProblems(Array.from({ length: 21 }, (_, i) => ({ id: `p${i}`, label: "x", kind: "TEXT" }))).some((p) => /at most 20/.test(p.message)));
  assert.ok(PARAMETER_KINDS.every((k) => targetFor(k)));
  assert.ok(isValueOfKind("PERIOD_RANGE", { from: "a", to: "b" }) && !isValueOfKind("PERIOD", ["a"]) && isValueOfKind("PLACE", ["a", "b"]) && !isValueOfKind("TEXT", "x".repeat(101)));
});

test("a block may read only a parameter of a matching kind", () => {
  assert.deepEqual(paramBindingProblems([{ param: "period", target: "period" }], [period]), []);
  assert.match(paramBindingProblems([{ param: "period", target: "place" }], [period])[0], /cannot be read as a place/);
  assert.match(paramBindingProblems([{ param: "gone", target: "period" }], [period])[0], /does not exist/);
});

test("the values in force are the viewer's valid choice or the default; an invalid choice is ignored", () => {
  assert.deepEqual(effectiveValues([period, places], {}), { period: "p2", places: null });
  assert.equal(effectiveValues([period], { period: "p1" }).period, "p1");
  assert.equal(effectiveValues([period], { period: "p9" }).period, "p2", "not an offered value");
  assert.equal(effectiveValues([period], { period: ["p1"] }).period, "p2", "wrong shape");
  assert.deepEqual(effectiveValues([places], { places: ["a", "b"] }).places, ["a", "b"]);
});

test("a block is narrowed only by the parameters it declares it reads", () => {
  const values = { period: "p1", places: ["rabak", "kosti"], text: "water" };
  assert.deepEqual(filterFor(undefined, values), { places: [], group: "", status: "", indicators: [], text: "" });
  const f = filterFor([{ param: "period", target: "period" }, { param: "places", target: "place" }], values);
  assert.equal(f.period, "p1");
  assert.deepEqual(f.places, ["rabak", "kosti"]);
  assert.equal(f.text, "");
});

test("actions only name destinations: links stay inside the product, and a missing target is a sentence", () => {
  const canvas = { pageIds: new Set(["p1"]), params: [period] };
  assert.deepEqual(actionProblems({ type: "OPEN_PAGE", pageId: "p1" }, canvas), []);
  assert.match(actionProblems({ type: "OPEN_PAGE", pageId: "zz" }, canvas)[0], /does not exist/);
  assert.deepEqual(actionProblems({ type: "SET_PARAM", param: "period", value: "CLICKED_LABEL" }, canvas), []);
  assert.match(actionProblems({ type: "SET_PARAM", param: "period", value: ["a"] }, canvas)[0], /does not fit/);
  assert.match(actionProblems({ type: "SET_PARAM", param: "gone", value: "x" }, canvas)[0], /does not exist/);
  for (const href of ["https://evil.example", "//evil.example", "javascript:alert(1)", "/ok\\bad", "relative/path"]) assert.equal(isInAppAddress(href), false, href);
  assert.ok(isInAppAddress("/projects/p1/data?x=1"));
  assert.match(actionProblems({ type: "OPEN_LINK", href: "https://evil.example" }, canvas)[0], /inside the product/);
  assert.match(actionProblems({ type: "OPEN_CANVAS", canvasId: "../x" }, canvas)[0], /cannot be right/);
});

test("running an action gives the change it asks for and nothing else", () => {
  assert.deepEqual(runAction({ type: "SET_PARAM", param: "period", value: "CLICKED_LABEL" }, "Jan"), { params: { period: "Jan" } });
  assert.deepEqual(runAction({ type: "SET_PARAM", param: "period", value: "CLICKED_LABEL" }, undefined), {});
  assert.deepEqual(runAction({ type: "SET_PARAM", param: "period", value: "p1" }, "x"), { params: { period: "p1" } });
  assert.deepEqual(runAction({ type: "OPEN_PAGE", pageId: "p2" }, undefined), { page: "p2" });
  assert.deepEqual(runAction({ type: "OPEN_CANVAS", canvasId: "c1", params: { a: "b" } }, undefined), { navigate: { canvasId: "c1", params: { a: "b" } } });
  assert.deepEqual(runAction({ type: "OPEN_LINK", href: "https://evil.example" }, undefined), {}, "an outside address is never followed");
  assert.deepEqual(runAction({ type: "OPEN_TABLE" }, undefined), { showTable: true });
});

test("a canvas with bad parameters, bindings or actions fails its structure check", () => {
  let c = blankCanvas({ id: "c", title: "T", scope: "MINE" });
  c = addBlock(c, "page-1", { id: "a", kind: "TEXT", props: { text: "x" } }).canvas;
  assert.deepEqual(canvasStructureProblems(c), []);
  const withParam = { ...c, params: [period], pages: c.pages.map((p) => ({ ...p, blocks: p.blocks.map((b) => ({ ...b, paramBindings: [{ param: "period", target: "period" }], action: { type: "OPEN_PAGE", pageId: "page-1" } })) })) };
  assert.deepEqual(canvasStructureProblems(withParam), []);
  const bad = { ...withParam, pages: withParam.pages.map((p) => ({ ...p, blocks: p.blocks.map((b) => ({ ...b, paramBindings: [{ param: "nope", target: "period" }], action: { type: "OPEN_LINK", href: "http://x" } })) })) };
  assert.equal(canvasStructureProblems(bad).length, 2);
});
