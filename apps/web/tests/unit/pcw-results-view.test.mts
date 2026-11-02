// Phase 38.3: the Results and Indicators slides' pure rules.
import test from "node:test";
import assert from "node:assert/strict";
import { BREAKDOWN_SUGGESTIONS, FREQUENCIES, INDICATOR_TYPES, INDICATOR_TYPE_LABEL, indicatorRows, indicatorTargets, needsParent, parentChoices, parseBreakdown, treeRows, unconfirmedCodes } from "../../src/features/project-setup/pcw/domain/results-view.ts";
import { PCW_COPY } from "../../src/features/project-setup/pcw/copy.ts";
import { findRawTokens } from "@donordesk/domain/core/copy-lint.js";

const n = (i: number, level: string, code: string | null, parentCode: string | null, extra = {}) =>
  ({ path: `logframe.${i}`, status: "EDITED", origin: "USER", quote: null, value: { level, code, title: `T-${code}`, description: null, parentCode, ...extra } }) as never;

const items = [n(0, "GOAL", "G1", null), n(1, "OUTCOME", "OC1", "G1"), n(2, "OUTPUT", "OP1", "OC1"), n(3, "ACTIVITY", "A1", "OP1"), n(4, "OUTCOME", "OC2", "G1"), n(5, "OUTPUT", "OP2", "OC2")];

test("the tree puts every result under its parent, in order, with its depth", () => {
  assert.deepEqual(treeRows(items).map((r) => [r.node.code, r.depth]), [["G1", 0], ["OC1", 1], ["OP1", 2], ["A1", 3], ["OC2", 1], ["OP2", 2]]);
});

test("a result whose parent is missing is shown at the top, never dropped", () => {
  const orphan = [n(0, "OUTPUT", "OP9", "GONE"), n(1, "ACTIVITY", "A9", "OP9")];
  assert.deepEqual(treeRows(orphan).map((r) => [r.node.code, r.depth]), [["OP9", 0], ["A9", 1]]);
});

test("a parent loop cannot hang the tree", () => {
  const loop = [n(0, "OUTCOME", "A", "B"), n(1, "OUTCOME", "B", "A")];
  assert.ok(treeRows(loop).length <= 2);
});

test("parents offered are the level above; an output and an activity must have one", () => {
  assert.deepEqual(parentChoices("OUTPUT", items).map((p) => p.code), ["OC1", "OC2"]);
  assert.deepEqual(parentChoices("GOAL", items), []);
  assert.equal(needsParent("OUTPUT") && needsParent("ACTIVITY"), true);
  assert.equal(needsParent("OUTCOME") || needsParent("GOAL"), false);
});

test("only generated codes the person has not kept are flagged", () => {
  const gen = [n(0, "GOAL", "G1", null, { codeSource: "GENERATED" }), n(1, "OUTCOME", "OC1", "G1", { codeSource: "GENERATED" }), n(2, "OUTPUT", "OP1", "OC1", { codeSource: "DOCUMENT" })];
  assert.deepEqual(unconfirmedCodes(gen, ["G1"]), ["OC1"]);
});

test("an indicator can measure an output, an outcome or the goal, deepest first, never an activity", () => {
  assert.deepEqual(indicatorTargets(items).map((t) => t.code), ["OP1", "OP2", "OC1", "OC2", "G1"]);
});

test("each indicator is joined to the person's decisions about it", () => {
  const view = {
    indicators: [{ path: "indicators.0", status: "EDITED", origin: "USER", quote: null, value: { code: "I1", title: "x" } }, { path: "indicators.1", status: "EDITED", origin: "USER", quote: null, value: { code: null, title: "y" } }],
    extras: { indicatorSetup: { I1: { ownerKey: "p-ali", direction: "LOWER", baselineNone: true } } },
  } as never;
  const rows = indicatorRows(view);
  assert.deepEqual([rows[0]!.ownerKey, rows[0]!.direction, rows[0]!.baselineNone], ["p-ali", "LOWER", true]);
  assert.deepEqual([rows[1]!.ownerKey, rows[1]!.direction, rows[1]!.baselineNone], ["", "", false]);
});

test("a typed breakdown becomes a clean list, and empty text clears it", () => {
  assert.deepEqual(parseBreakdown(" Sex, Age group ,, Sex"), ["Sex", "Age group"]);
  assert.equal(parseBreakdown("  ,"), null);
});

test("the kinds, frequencies and words on these slides are plain language", () => {
  assert.deepEqual(INDICATOR_TYPES.sort(), ["CURRENCY", "NUMBER", "PERCENTAGE", "RATIO"]);
  const texts = [...Object.values(INDICATOR_TYPE_LABEL), ...FREQUENCIES, ...BREAKDOWN_SUGGESTIONS, ...Object.values(PCW_COPY.indicators), ...Object.values(PCW_COPY.results).filter((v): v is string => typeof v === "string"), PCW_COPY.results.keepCodes(3)];
  for (const t of texts) assert.deepEqual(findRawTokens(t), [], t);
});
