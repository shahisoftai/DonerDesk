import test from "node:test";
import assert from "node:assert/strict";
import {
  ANIMATIONS, animationProblems, mayAnimate, counterAt, raceFrames, storyProblems, stepIndex, MAX_DURATION_MS,
  evaluateAlert, shouldNotify, alertRuleProblems, savedViewProblems, applyView, MAX_VIEWS_PER_CANVAS,
} from "../dist/index.js";

const spec = { durationMs: 1000, delayMs: 200, easing: "LINEAR" };

test("animations suit the right pictures and have sane limits; reduced motion, files and a viewer's switch turn them off", () => {
  assert.deepEqual(animationProblems({ animation: "COUNT_UP", durationMs: 500, delayMs: 0, easing: "LINEAR" }, "NUMBER"), []);
  assert.deepEqual(animationProblems({ animation: "COUNT_UP", durationMs: 500, delayMs: 0, easing: "LINEAR" }, "MAP"), ["That animation does not suit this block."]);
  assert.ok(animationProblems({ animation: "FADE", durationMs: 10, delayMs: 0, easing: "LINEAR" }, "TEXT").length === 1);
  assert.ok(animationProblems({ animation: "FADE", durationMs: MAX_DURATION_MS + 1, delayMs: 9999, easing: "BOUNCE" }, "TEXT").length === 3);
  assert.equal(ANIMATIONS.every((a) => animationProblems({ animation: a, durationMs: 400, delayMs: 0, easing: "EASE_OUT" }, "TEXT").length <= 1), true);
  assert.equal(mayAnimate({ prefersReducedMotion: false, viewerDisabled: false, forFile: false }), true);
  for (const o of [{ prefersReducedMotion: true }, { viewerDisabled: true }, { forFile: true }]) assert.equal(mayAnimate({ prefersReducedMotion: false, viewerDisabled: false, forFile: false, ...o }), false);
});

test("a counter waits for its delay, rises monotonically and always ends on the exact figure; a gap never animates", () => {
  assert.equal(counterAt(100, 0, spec), 0);
  assert.equal(counterAt(100, 700, spec), 50);
  assert.equal(counterAt(100, 1200, spec), 100);
  assert.equal(counterAt(100, 99999, spec), 100);
  assert.equal(counterAt(1234.567, 5000, spec, 1), 1234.567, "the end is the recorded figure, not a rounded one");
  assert.equal(counterAt(null, 500, spec), null);
  const values = [0, 300, 500, 800, 1100, 1200].map((t) => counterAt(1000, t, { ...spec, easing: "EASE_IN_OUT" }));
  assert.deepEqual([...values].sort((a, b) => a - b), values);
});

test("a bar race ranks recorded values per period, keeps gaps as gaps and names every period", () => {
  const periods = [{ id: "p1", label: "Jan" }, { id: "p2", label: "Feb" }];
  const items = [{ id: "a", label: "Alpha" }, { id: "b", label: "Beta" }, { id: "c", label: "Gamma" }];
  const data = { "a|p1": 5, "b|p1": 9, "a|p2": 12, "c|p2": 12 };
  const frames = raceFrames(periods, items, (i, p) => data[`${i}|${p}`] ?? null);
  assert.deepEqual(frames.map((f) => f.label), ["Jan", "Feb"]);
  assert.deepEqual(frames[0].entries.map((e) => [e.id, e.rank]), [["b", 1], ["a", 2], ["c", null]]);
  assert.equal(frames[0].entries.find((e) => e.id === "c").value, null, "a gap is not a bar of 0");
  assert.deepEqual(frames[1].entries.map((e) => [e.id, e.rank]), [["a", 1], ["c", 2], ["b", null]], "a tie is broken by name");
});

test("a story is checked: pages, highlighted blocks, parameters, captions; stepping stays inside it", () => {
  const canvas = { pageIds: new Set(["p1", "p2"]), blockPage: new Map([["b1", "p1"], ["b2", "p2"]]), paramIds: new Set(["period"]) };
  const good = [{ id: "s1", pageId: "p1", highlightBlockId: "b1", params: { period: "x" }, caption: "Water points" }, { id: "s2", pageId: "p2", caption: "" }];
  assert.deepEqual(storyProblems(good, canvas), []);
  const bad = [{ id: "s1", pageId: "zz", caption: "" }, { id: "s1", pageId: "p1", highlightBlockId: "b2", params: { nope: 1 }, caption: "x".repeat(401) }];
  assert.equal(storyProblems(bad, canvas).length, 5);
  assert.equal(stepIndex(0, 3, "PREVIOUS"), 0);
  assert.equal(stepIndex(2, 3, "NEXT"), 2);
  assert.equal(stepIndex(1, 3, "LAST"), 2);
  assert.equal(stepIndex(1, 0, "NEXT"), 0);
});

test("alerts judge only what can be judged: no percent of target for a rate, no verdict on a missing figure unless the rule is about one", () => {
  assert.equal(evaluateAlert({ kind: "BELOW", value: 50 }, { current: 40 }), "FIRING");
  assert.equal(evaluateAlert({ kind: "BELOW", value: 50 }, { current: 50 }), "OK");
  assert.equal(evaluateAlert({ kind: "BELOW", value: 50 }, { current: null }), "NO_DATA");
  assert.equal(evaluateAlert({ kind: "NO_VALUE" }, { current: null }), "FIRING");
  assert.equal(evaluateAlert({ kind: "NO_VALUE" }, { current: 0 }), "OK", "a real 0 is a value");
  assert.equal(evaluateAlert({ kind: "ABOVE", value: 10 }, { current: 11 }), "FIRING");
  assert.equal(evaluateAlert({ kind: "BELOW_PERCENT_OF_TARGET", value: 50 }, { current: 40, target: 100 }), "FIRING");
  assert.equal(evaluateAlert({ kind: "BELOW_PERCENT_OF_TARGET", value: 50 }, { current: 40, target: 100, isRate: true }), "NO_DATA");
  assert.equal(evaluateAlert({ kind: "BELOW_PERCENT_OF_TARGET", value: 50 }, { current: 40, target: 100, lowerIsBetter: true }), "NO_DATA");
  assert.equal(evaluateAlert({ kind: "BELOW_PERCENT_OF_TARGET", value: 50 }, { current: 40, target: 0 }), "NO_DATA");
  assert.equal(evaluateAlert({ kind: "WORSE_THAN_PREVIOUS" }, { current: 8, previous: 10 }), "FIRING");
  assert.equal(evaluateAlert({ kind: "WORSE_THAN_PREVIOUS" }, { current: 8, previous: 10, lowerIsBetter: true }), "OK");
  assert.equal(evaluateAlert({ kind: "WORSE_THAN_PREVIOUS" }, { current: 8 }), "NO_DATA");
  assert.deepEqual(alertRuleProblems({ kind: "BELOW" }), ["This rule needs a number."]);
  assert.deepEqual(alertRuleProblems({ kind: "BELOW_PERCENT_OF_TARGET", value: 5000 }), ["A percent of target is between 0 and 1000."]);
  assert.deepEqual(alertRuleProblems({ kind: "NO_VALUE" }), []);
});

test("an alert notifies once per crossing, not on every run", () => {
  assert.equal(shouldNotify(undefined, "FIRING"), true);
  assert.equal(shouldNotify("OK", "FIRING"), true);
  assert.equal(shouldNotify("NO_DATA", "FIRING"), true);
  assert.equal(shouldNotify("FIRING", "FIRING"), false);
  assert.equal(shouldNotify("FIRING", "OK"), false);
  assert.equal(shouldNotify("OK", "OK"), false);
});

test("saved views hold only parameter values; stale parameters are dropped and named", () => {
  const ids = new Set(["period", "places"]);
  const view = { id: "v1", name: "Rabak, March", canvasId: "c1", values: { period: "p3", places: ["rabak"] } };
  assert.deepEqual(savedViewProblems(view, ids), []);
  assert.ok(savedViewProblems({ ...view, name: " " }, ids).length === 1);
  assert.ok(savedViewProblems({ ...view, values: { gone: "x" } }, ids)[0].includes("no longer exists"));
  const many = Array.from({ length: MAX_VIEWS_PER_CANVAS }, (_, i) => ({ ...view, id: `o${i}` }));
  assert.ok(savedViewProblems(view, ids, many).some((p) => /at most/.test(p)));
  assert.deepEqual(applyView({ ...view, values: { period: "p3", gone: "x" } }, ids), { values: { period: "p3" }, dropped: ["gone"] });
});
