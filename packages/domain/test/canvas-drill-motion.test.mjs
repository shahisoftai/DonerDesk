import test from "node:test";
import assert from "node:assert/strict";
import {
  NO_FILTER, EMPTY_CHOICES, pickToFilter, isFiltered, drillUp, levelsOf, indicatorChoicesOf, restrictSheet, restrictSheetToLevel, restrictSheetToIndicator,
  setBlockMotion, pictureOfBlock, canvasStructureProblems, checkPlaceFlow, FLOW_LIMITS, DEFAULT_ANIMATION,
} from "../dist/index.js";
import { kernelDensity, bandwidth } from "../dist/contexts/reporting/chart-render-kinds-spread.js";

const sheet = {
  projectId: "p", periods: [{ id: "p1", label: "Jan", start: "2026-01-01", end: "2026-01-31", reportType: "MONTHLY", locked: false }], finance: [],
  indicators: [
    { id: "i1", code: "OC1", name: "Children enrolled", level: "Outcome", type: "NUMBER", baseline: "0", target: "100", isRate: false },
    { id: "i2", code: "OP1", name: "Teachers trained", level: "Output", type: "NUMBER", baseline: "0", target: "50", isRate: false },
    { id: "i3", code: "OP2", name: "Kits given", level: "Output", type: "NUMBER", baseline: "0", target: "80", isRate: false },
  ],
  cells: ["i1", "i2", "i3"].map((id, k) => ({ indicatorId: id, periodId: "p1", periodValue: String(10 * (k + 1)), cumulativeValue: "", status: "VERIFIED" })),
};
const choices = { ...EMPTY_CHOICES, levels: levelsOf(sheet), indicators: indicatorChoicesOf(sheet) };

test("the drill: a click on a level, then an indicator, narrows step by step and the same label clears it", () => {
  assert.deepEqual(choices.levels, ["Outcome", "Output"]);
  const atOutput = pickToFilter(choices, NO_FILTER, "output");
  assert.equal(atOutput.level, "Output");
  const atKits = pickToFilter(choices, atOutput, "OP2");
  assert.equal(atKits.indicator, "i3");
  assert.equal(pickToFilter(choices, atKits, "OP2").indicator, "", "again clears it");
  assert.equal(pickToFilter(choices, atKits, "Outcome").indicator, "", "a new level starts the drill again");
  assert.equal(isFiltered(atKits), true);
});

test("drilling up clears the most specific narrowing first", () => {
  const f = { ...NO_FILTER, periodId: "p1", places: ["gulu"], group: "Female", indicator: "i3", level: "Output" };
  const steps = [];
  let cur = f;
  while (isFiltered(cur)) { cur = drillUp(cur); steps.push(["group", "indicator", "level", "places", "periodId"].filter((k) => (Array.isArray(cur[k]) ? cur[k].length : cur[k]))); }
  assert.deepEqual(steps.map((s) => s.length), [4, 3, 2, 1, 0]);
  assert.deepEqual(drillUp(NO_FILTER), NO_FILTER);
});

test("a level or indicator narrows the sheet to its own indicators and figures; nothing is recomputed", () => {
  const out = restrictSheetToLevel(sheet, "Output");
  assert.deepEqual(out.indicators.map((i) => i.id), ["i2", "i3"]);
  assert.equal(out.cells.length, 2);
  assert.deepEqual(restrictSheetToIndicator(sheet, "OC1").indicators.map((i) => i.id), ["i1"]);
  assert.deepEqual(restrictSheet(sheet, { level: "Output", indicator: "OP2" }).indicators.map((i) => i.id), ["i3"]);
  assert.equal(restrictSheet(sheet, {}), sheet, "no narrowing returns the same sheet");
  assert.equal(restrictSheetToLevel(sheet, "").indicators.length, 3);
});

const canvasWith = (block) => ({ id: "c", title: "T", scope: "MINE", mode: "LIVE", profile: "LIVE_INTERNAL", language: "en", themeId: "DEFAULT", revision: 1, pages: [{ id: "pg", title: "Page", format: "WEB_FLUID", blocks: [block] }] });
const kpi = { id: "b1", kind: "KPI", bounds: { x: 0, y: 0, w: 3, h: 2 }, props: { indicatorId: "i1", includeDraft: false }, bindings: [] };
const bar = { id: "b2", kind: "CHART", bounds: { x: 0, y: 2, w: 6, h: 4 }, props: { spec: { version: 2, kind: "BAR", dataset: { template: "INDICATORS_PROGRESS", indicatorIds: ["a"], measure: "PERIOD", showTarget: false, includeDraft: false } } }, bindings: [] };
const map = { id: "b3", kind: "MAP", bounds: { x: 0, y: 6, w: 6, h: 4 }, props: { view: "RESULTS" }, bindings: [] };

test("what a block's picture is decides which motions suit it", () => {
  assert.equal(pictureOfBlock(kpi), "NUMBER");
  assert.equal(pictureOfBlock(bar), "CHART_BAR");
  assert.equal(pictureOfBlock(map), "MAP");
  assert.equal(pictureOfBlock({ kind: "NOPE", props: {} }), "OTHER");
});

test("a motion that suits is stored; one that does not is refused with a sentence; NONE takes it away", () => {
  const c = canvasWith(kpi);
  const ok = setBlockMotion(c, "b1", { ...DEFAULT_ANIMATION, animation: "COUNT_UP", durationMs: 800 });
  assert.equal(ok.ok, true);
  assert.equal(ok.canvas.pages[0].blocks[0].motion.animation, "COUNT_UP");
  const bad = setBlockMotion(canvasWith(map), "b3", { ...DEFAULT_ANIMATION, animation: "COUNT_UP" });
  assert.equal(bad.ok, false);
  assert.match(bad.reason, /does not suit/);
  const tooLong = setBlockMotion(c, "b1", { ...DEFAULT_ANIMATION, animation: "FADE", durationMs: 9000 });
  assert.equal(tooLong.ok, false);
  const cleared = setBlockMotion(ok.canvas, "b1", undefined);
  assert.equal(cleared.canvas.pages[0].blocks[0].motion, undefined);
});

test("a stored canvas whose motion does not suit its block is a structure problem", () => {
  const problems = canvasStructureProblems(canvasWith({ ...map, motion: { ...DEFAULT_ANIMATION, animation: "GROW" } }));
  assert.ok(problems.some((p) => /does not suit/.test(p.message)));
  assert.deepEqual(canvasStructureProblems(canvasWith({ ...kpi, motion: { ...DEFAULT_ANIMATION, animation: "COUNT_UP" } })).filter((p) => /suit/.test(p.message)), []);
});

test("a movement names two different live places, says what moves, and has a quantity above zero", () => {
  const live = new Set(["a", "b"]);
  const base = { fromPlaceId: "a", toPlaceId: "b", what: "  People ", quantity: 12, unit: " households " };
  const good = checkPlaceFlow(base, live, 0);
  assert.equal(good.ok, true);
  assert.deepEqual([good.value.what, good.value.unit], ["People", "households"]);
  for (const [change, word] of [[{ toPlaceId: "a" }, /different/], [{ fromPlaceId: "z" }, /moves from/], [{ what: " " }, /what moves/], [{ quantity: 0 }, /above zero/], [{ quantity: -3 }, /above zero/], [{ quantity: Number.NaN }, /above zero/], [{ quantity: 1e13 }, /too large/]]) {
    const r = checkPlaceFlow({ ...base, ...change }, live, 0);
    assert.equal(r.ok, false);
    assert.match(r.problem, word);
  }
  assert.equal(checkPlaceFlow(base, live, FLOW_LIMITS.perProject).ok, false, "a project keeps a bounded list");
});

test("a kernel density is a proper curve: it integrates to about one and is widest near the middle of the values", () => {
  const values = [10, 12, 13, 14, 15, 30];
  const xs = Array.from({ length: 400 }, (_, i) => -20 + (i * 80) / 399);
  const d = kernelDensity(values, xs, bandwidth(values));
  const area = d.reduce((t, y) => t + y, 0) * (80 / 399);
  assert.ok(Math.abs(area - 1) < 0.02, `area ${area}`);
  const peak = xs[d.indexOf(Math.max(...d))];
  assert.ok(peak > 10 && peak < 16, `peak at ${peak}`);
  assert.ok(bandwidth([5, 5, 5, 5]) > 0, "identical values still give a width");
});
