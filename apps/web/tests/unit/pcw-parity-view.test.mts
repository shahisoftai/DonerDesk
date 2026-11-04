import { test } from "node:test";
import assert from "node:assert/strict";
import { AREAS_OF_SLIDE, sectionNoticeFor, anyAreaRunning, areaState, leftOutFor, moveParents } from "../../src/features/project-setup/pcw/domain/parity-view.ts";

const node = (level: string, code: string, parentCode: string | null) => ({ path: code, status: "ACCEPTED", origin: "USER", quote: null, value: { level, code, parentCode, title: code } });
const view = (over: object = {}) => ({ leftOut: [], areaRuns: {}, logframe: [], ...over }) as never;

test("left-out items show only on the step they belong to, and an empty list shows nothing", () => {
  const v = view({ leftOut: [{ area: "LOGFRAME", total: 2, items: [] }, { area: "PLACES", total: 0, items: [] }] });
  assert.equal(leftOutFor(v, "RESULTS").length, 1);
  assert.equal(leftOutFor(v, "PLACES").length, 0);
  assert.equal(leftOutFor(v, "FINANCE").length, 0);
});

test("a part being read again is noticed, and a failed one is named", () => {
  assert.equal(anyAreaRunning(view({ areaRuns: { LOGFRAME: "RUNNING" } })), true);
  assert.equal(anyAreaRunning(view({ areaRuns: { LOGFRAME: "FINISHED" } })), false);
  assert.equal(areaState(view({ areaRuns: { PLAN: "FAILED" } }), "WORK_PLAN"), "FAILED");
  assert.equal(areaState(view({ areaRuns: { PLAN: "FAILED" } }), "RESULTS"), null);
});

test("a result is never offered itself or anything under it as a parent", () => {
  const v = view({ logframe: [node("GOAL", "G1", null), node("OUTCOME", "OC1", "G1"), node("OUTCOME", "OC2", "G1"), node("OUTPUT", "OP1", "OC1")] });
  assert.deepEqual(moveParents("OUTPUT", v, "OP1").map((p) => p.code), ["OC1", "OC2"]);
  assert.deepEqual(moveParents("OUTCOME", v, "OC1").map((p) => p.code), ["G1"]);
});

test("every part a step reads again is a name the API accepts", () => {
  const known = ["FACTS", "LOGFRAME", "INDICATORS", "PERIODS", "PLAN", "PLACES", "FUNDING_BUDGET", "RISKS"];
  for (const areas of Object.values(AREAS_OF_SLIDE)) for (const a of areas ?? []) assert.ok(known.includes(a), a);
});

test("a step is told about blank or missing sections of its own part only", () => {
  const v = view({ sectionFindings: [{ area: "PLAN", state: "EMPTY", emptyHeadings: ["Gantt"] }, { area: "LOGFRAME", state: "FOUND", emptyHeadings: [] }] });
  assert.equal(sectionNoticeFor(v, "WORK_PLAN").length, 1);
  assert.equal(sectionNoticeFor(v, "RESULTS").length, 0);
});
