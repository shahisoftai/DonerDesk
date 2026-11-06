import test from "node:test";
import assert from "node:assert/strict";
import { addWidget, moveWidget, resizeWidget, removeWidget, settleLayout, widgetProblems, readingOrder, gridRows, canEditDashboard, canSeeDashboard, dashboardScopeProblem } from "../dist/index.js";

const spec = (over = {}) => ({ template: "INDICATOR_OVER_TIME", indicatorIds: ["i1"], measure: "PERIOD", type: "BAR", showTarget: false, ...over });
const w = (id, x, y, ww = 6, h = 4, over = {}) => ({ id, projectId: "p1", spec: spec(), x, y, w: ww, h, ...over });
const noOverlap = (ws) => ws.every((a, i) => ws.every((b, j) => i === j || a.x >= b.x + b.w || b.x >= a.x + a.w || a.y >= b.y + b.h || b.y >= a.y + a.h));

test("a new chart goes below the others at the default size; the limit is respected", () => {
  let ws = [];
  ws = addWidget(ws, { id: "a", projectId: "p1", spec: spec() });
  ws = addWidget(ws, { id: "b", projectId: "p1", spec: spec() });
  assert.deepEqual(ws.map((x) => [x.id, x.x, x.y, x.w, x.h]), [["a", 0, 0, 6, 4], ["b", 0, 4, 6, 4]]);
  let many = [];
  for (let i = 0; i < 24; i += 1) many = addWidget(many, { id: `w${i}`, projectId: "p1", spec: spec() });
  assert.equal(many.length, 24);
  assert.equal(addWidget(many, { id: "extra", projectId: "p1", spec: spec() }), null);
});

test("moving a chart onto another pushes that one down, nothing overlaps, and nothing floats above a gap", () => {
  const ws = [w("a", 0, 0), w("b", 6, 0), w("c", 0, 4)];
  const moved = moveWidget(ws, "c", 6, 0);
  assert.ok(noOverlap(moved));
  const at = Object.fromEntries(moved.map((x) => [x.id, [x.x, x.y]]));
  assert.deepEqual(at.c, [6, 0], "the chart being moved keeps its place");
  assert.deepEqual(at.b, [6, 4], "the one it landed on goes below");
  assert.deepEqual(at.a, [0, 0]);
  const gap = moveWidget([w("a", 0, 0), w("b", 0, 4)], "a", 6, 0);
  assert.deepEqual(gap.find((x) => x.id === "b").y, 0, "b rises into the space a left");
});

test("positions and sizes are clamped to the grid", () => {
  const moved = moveWidget([w("a", 0, 0)], "a", 99, -5);
  assert.deepEqual([moved[0].x, moved[0].y], [6, 0]);
  const resized = resizeWidget([w("a", 0, 0), w("b", 6, 0)], "a", 40, 40);
  assert.deepEqual([resized[0].w, resized[0].h], [12, 10]);
  assert.ok(noOverlap(resized));
  assert.deepEqual([resizeWidget([w("a", 0, 0)], "a", 1, 1)[0].w, resizeWidget([w("a", 0, 0)], "a", 1, 1)[0].h], [3, 2]);
});

test("removing a chart closes the gap; the list order is kept; reading order is top-left first", () => {
  const ws = [w("a", 0, 0), w("b", 0, 4), w("c", 6, 0)];
  const rest = removeWidget(ws, "a");
  assert.deepEqual(rest.map((x) => x.id), ["b", "c"]);
  assert.equal(rest.find((x) => x.id === "b").y, 0);
  assert.deepEqual(readingOrder(ws).map((x) => x.id), ["a", "c", "b"]);
  assert.equal(gridRows(ws), 8);
  assert.deepEqual(settleLayout(ws).map((x) => x.id), ["a", "b", "c"]);
});

test("a widget is checked: template, indicators for the template, chart type, colours, bounds", () => {
  assert.deepEqual(widgetProblems([w("a", 0, 0)]), []);
  const msg = (x) => widgetProblems([x]).map((p) => p.message).join(" | ");
  assert.match(msg(w("a", 0, 0, 6, 4, { spec: spec({ template: "NOPE" }) })), /template is not known/);
  assert.match(msg(w("a", 0, 0, 6, 4, { spec: spec({ indicatorIds: [] }) })), /exactly one indicator/);
  assert.match(msg(w("a", 0, 0, 6, 4, { spec: spec({ type: "PIE" }) })), /cannot be drawn/);
  assert.match(msg(w("a", 0, 0, 6, 4, { spec: spec({ colors: ["red"] }) })), /#rrggbb/);
  assert.match(msg(w("a", 8, 0, 6, 4)), /past column/);
  assert.match(msg(w("a", 0, 0, 2, 4)), /at least 3 wide/);
  assert.match(msg(w("a", 0.5, 0)), /whole/);
  assert.match(msg(w("a", 0, 0, 6, 4, { projectId: "" })), /needs a project/);
  assert.match(widgetProblems([w("a", 0, 0), w("a", 6, 0)])[0].message, /share an id/);
});

test("who sees and who changes a dashboard", () => {
  const mine = { scope: "MINE", ownerId: "u1" };
  const org = { scope: "ORG", ownerId: "u1" };
  assert.equal(canSeeDashboard(mine, { userId: "u2" }), false);
  assert.equal(canSeeDashboard(org, { userId: "u2" }), true);
  assert.equal(canEditDashboard(mine, { userId: "u2", canManageShared: true }), false, "a personal dashboard is never changed by someone else");
  assert.equal(canEditDashboard(org, { userId: "u2", canManageShared: true }), true);
  assert.equal(canEditDashboard(org, { userId: "u2", canManageShared: false }), false);
  assert.equal(canEditDashboard(org, { userId: "u1", canManageShared: false }), true);
  assert.match(dashboardScopeProblem({ scope: "PROJECT", ownerId: "u" }), /needs a project/);
  assert.match(dashboardScopeProblem({ scope: "ORG", ownerId: "u", projectId: "p" }), /Only a project/);
  assert.equal(dashboardScopeProblem({ scope: "MINE", ownerId: "u" }), null);
});

/* ---------- Dashboards v2: Chart Studio charts and text blocks (Phase 34.3) ---------- */
import { isSpecV2 as isV2, widgetProblems as problemsOf, addWidget as addW, settleLayout as settle } from "../dist/index.js";

const v2spec = (over = {}) => ({ version: 2, kind: "FUNNEL", dataset: { template: "INDICATORS_PROGRESS", indicatorIds: ["a", "b"], measure: "CUMULATIVE", showTarget: false, includeDraft: true }, ...over });
const w2 = (over = {}) => ({ id: "w", projectId: "p1", x: 0, y: 0, w: 6, h: 4, spec: v2spec(), ...over });

test("a Chart Studio chart is a valid widget, checked by the studio's own validator", () => {
  assert.equal(isV2(v2spec()), true);
  assert.equal(isV2({ template: "X", type: "BAR" }), false);
  assert.deepEqual(problemsOf([w2()]), []);
  assert.match(problemsOf([w2({ spec: v2spec({ kind: "NOPE" }) })])[0].message, /not offered/);
  assert.match(problemsOf([w2({ spec: v2spec({ kind: "POPULATION_PYRAMID" }) })])[0].message, /not available yet/);
  assert.match(problemsOf([w2({ spec: v2spec({ kind: "BAR", axes: { y: { min: 50 } } }) })])[0].message, /starts at zero/);
  assert.match(problemsOf([w2({ spec: v2spec({ kind: "GAUGE" }) })])[0].message, /cannot be drawn/);
});

test("a text block needs text and is not a chart: no settings are asked of it", () => {
  assert.deepEqual(problemsOf([{ id: "t", projectId: "p1", kind: "TEXT", text: "Figures are cumulative.", x: 0, y: 0, w: 12, h: 2 }]), []);
  assert.match(problemsOf([{ id: "t", projectId: "p1", kind: "TEXT", text: "  ", x: 0, y: 0, w: 12, h: 2 }])[0].message, /needs some text/);
  assert.match(problemsOf([{ id: "t", projectId: "p1", kind: "TEXT", text: "x".repeat(2001), x: 0, y: 0, w: 12, h: 2 }])[0].message, /at most 2000/);
});

test("a chart with no settings is refused; old and new charts can share a dashboard and a layout", () => {
  assert.match(problemsOf([{ id: "c", projectId: "p1", x: 0, y: 0, w: 6, h: 4 }])[0].message, /needs its settings/);
  const old = { id: "o", projectId: "p1", x: 0, y: 0, w: 6, h: 4, spec: { template: "INDICATOR_OVER_TIME", indicatorIds: ["a"], measure: "PERIOD", type: "BAR", showTarget: false } };
  const mixed = settle([old, w2({ id: "n", x: 0, y: 0 })]);
  assert.deepEqual(problemsOf(mixed), []);
  assert.notEqual(mixed[0].y, mixed[1].y, "they do not overlap: one falls below the other");
  const added = addW([old], { id: "t", projectId: "p1", kind: "TEXT", text: "Hello" });
  assert.equal(added.length, 2);
  assert.equal(added[1].kind, "TEXT");
});
