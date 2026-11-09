import test from "node:test";
import assert from "node:assert/strict";
import { blocksToReload, changedFigures, nextPollDelay, sourcesChanged } from "../../src/features/visual-data/domain/live-refresh.ts";

const p = (epoch: string, versions: Record<string, number>) => ({ epoch, versions });

test("the first ask records state and is not a change", () => {
  assert.deepEqual(sourcesChanged(undefined, p("e", { plan: 1 })), []);
});

test("only sources whose version moved are changed; a new epoch means everything may have", () => {
  assert.deepEqual(sourcesChanged(p("e", { plan: 1, spending: 2 }), p("e", { plan: 2, spending: 2 })), ["plan"]);
  assert.deepEqual(sourcesChanged(p("e", { plan: 1 }), p("e", { plan: 1 })), []);
  assert.deepEqual(sourcesChanged(p("e", { plan: 1 }), p("e", { plan: 1, activities: 1 })), ["activities"]);
  assert.deepEqual(sourcesChanged(p("old", { plan: 5 }), p("new", { plan: 0, spending: 0 })).sort(), ["plan", "spending"]);
});

test("only the blocks that read a changed source of their own project are reloaded", () => {
  const reads = [
    { blockId: "a", projectId: "p1", sources: ["plan"] }, { blockId: "b", projectId: "p1", sources: ["spending"] },
    { blockId: "c", projectId: "p2", sources: ["plan"] }, { blockId: "d", projectId: "p3", sources: ["plan"] },
  ];
  const seen = { p1: p("e", { plan: 1, spending: 1 }), p2: p("e", { plan: 1 }) };
  const now = { p1: p("e", { plan: 2, spending: 1 }), p2: p("e", { plan: 1 }), p3: p("e", { plan: 9 }) };
  assert.deepEqual(blocksToReload(reads, seen, now), ["a"], "p2 did not change; p3 was never seen so its first ask is not a change");
});

test("polling is steady, backs off after failures up to five minutes, and stops while hidden or offline", () => {
  assert.equal(nextPollDelay({ failures: 0, hidden: false, offline: false }), 30);
  assert.equal(nextPollDelay({ failures: 1, hidden: false, offline: false }), 60);
  assert.equal(nextPollDelay({ failures: 2, hidden: false, offline: false }), 120);
  assert.equal(nextPollDelay({ failures: 9, hidden: false, offline: false }), 300);
  assert.equal(nextPollDelay({ failures: 0, hidden: true, offline: false }), null);
  assert.equal(nextPollDelay({ failures: 0, hidden: false, offline: true }), null);
});

test("figures that changed since the last draw are found by row and column", () => {
  const before = [{ a: 1, b: 2 }, { a: 3, b: 4 }];
  const after = [{ a: 1, b: 5 }, { a: 3, b: 4 }, { a: 9, b: 9 }];
  assert.deepEqual([...changedFigures(before, after, ["a", "b"])], ["0:b"]);
});
