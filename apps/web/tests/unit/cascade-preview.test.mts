import { test } from "node:test";
import assert from "node:assert/strict";
import { cascadePreview } from "../../src/features/workplan/domain/cascade-preview.ts";

const row = (id: string, title: string, start: string, end: string, comesBefore: string[] = [], status = "PLANNED") => ({ id, title, plannedStart: start, plannedEnd: end, status, comesBefore: comesBefore.map((x) => ({ id: x })) });

test("moving an activity later lists the ones that wait for it, with their new dates and what caused it", () => {
  const rows = [row("a", "Survey", "2026-03-10", "2026-03-12", ["b"]), row("b", "Training", "2026-03-13", "2026-03-14", ["c"]), row("c", "Outreach", "2026-03-15", "2026-03-16")];
  const res = cascadePreview(rows, "a", "2026-03-20", "2026-03-22");
  assert.deepEqual(res.moves.map((m) => [m.title, m.to.start, m.to.end, m.causedBy]), [["Training", "2026-03-23", "2026-03-24", "Survey"], ["Outreach", "2026-03-25", "2026-03-26", "Training"]]);
  assert.deepEqual(res.moves[0]!.from, { start: "2026-03-13", end: "2026-03-14" });
});

test("moving earlier moves nothing else, and a done successor is listed as staying put", () => {
  const rows = [row("a", "Survey", "2026-03-10", "2026-03-12", ["b"]), row("b", "Training", "2026-03-13", "2026-03-14", [], "DONE")];
  assert.deepEqual(cascadePreview(rows, "a", "2026-03-01", "2026-03-02"), { moves: [], blocked: [] });
  assert.deepEqual(cascadePreview(rows, "a", "2026-03-20", "2026-03-22").blocked, [{ id: "b", title: "Training", reason: "DONE" }]);
});

test("an activity with nothing waiting for it previews nothing", () => {
  assert.deepEqual(cascadePreview([row("a", "Solo", "2026-03-10", "2026-03-12")], "a", "2026-04-01", "2026-04-02"), { moves: [], blocked: [] });
});
