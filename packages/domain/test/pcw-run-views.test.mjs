import test from "node:test";
import assert from "node:assert/strict";
import { leftOutFromRuns, areaRunStates } from "../dist/index.js";

const at = (min) => new Date(Date.UTC(2026, 10, 2, 8, min));
const run = (area, status, min, detail = {}, kind = "EXTRACT") => ({ kind, area, status, detail, startedAt: at(min) });
const item = (text, reason = "QUOTE_NOT_FOUND", field = "logframe") => ({ field, text, reason });

test("what a reading left out is read from its latest finished run, with the count kept even when the list is capped", () => {
  const runs = [
    run("LOGFRAME", "FINISHED", 1, { dropped: 9, leftOut: JSON.stringify([item("Improved health")]) }),
    run("LOGFRAME", "FINISHED", 5, { dropped: 12, leftOut: JSON.stringify([item("A"), item("B", "DATE_NOT_IN_QUOTE")]) }),
    run("PLAN", "FINISHED", 2, { dropped: 0 }),
  ];
  const out = leftOutFromRuns(runs);
  assert.deepEqual(out.map((a) => [a.area, a.total, a.items.length]), [["LOGFRAME", 12, 2]], "the later reading replaces the earlier one; a part that left nothing out is absent");
  assert.equal(out[0].items[1].reason, "DATE_NOT_IN_QUOTE");
});

test("a damaged record reads as nothing left out; a reading that failed or is running is not used", () => {
  assert.deepEqual(leftOutFromRuns([run("PLAN", "FINISHED", 1, { leftOut: "not json" })]), []);
  assert.deepEqual(leftOutFromRuns([run("PLAN", "FINISHED", 1, { leftOut: JSON.stringify([{ field: "x" }, "y", null, { field: "a", text: "b", reason: "ODD" }]), dropped: 0 })]), []);
  assert.equal(leftOutFromRuns([run("PLAN", "FINISHED", 1, { leftOut: "not json", dropped: 3 })])[0].total, 3, "the count survives a damaged list");
  assert.deepEqual(leftOutFromRuns([run("PLAN", "FAILED", 1, { dropped: 5 }), run("RISKS", "RUNNING", 2, { dropped: 5 }), run("FACTS", "FINISHED", 3, { dropped: 4 }, "APPLY")]), []);
});

test("each part's reading state is its latest run; a run that has gone on too long has stopped", () => {
  const staleMs = 6 * 60_000;
  const runs = [run("PLAN", "FAILED", 0), run("PLAN", "RUNNING", 10), run("RISKS", "RUNNING", 1), run("FACTS", "FINISHED", 2), run("PLACES", "FAILED", 3), run("PLAN", "FINISHED", 1, {}, "APPLY")];
  assert.deepEqual(areaRunStates(runs, at(12), staleMs), { PLAN: "RUNNING", RISKS: "FAILED", FACTS: "FINISHED", PLACES: "FAILED" });
  assert.deepEqual(areaRunStates(runs, at(30), staleMs).PLAN, "FAILED");
  assert.deepEqual(areaRunStates([], at(0), staleMs), {});
});

test("the run views never change the runs they were given", () => {
  const runs = [run("LOGFRAME", "FINISHED", 5, { dropped: 1, leftOut: JSON.stringify([item("A")]) }), run("LOGFRAME", "FINISHED", 1)];
  const before = JSON.stringify(runs);
  leftOutFromRuns(runs); areaRunStates(runs, at(9), 1000);
  assert.equal(JSON.stringify(runs), before);
});
