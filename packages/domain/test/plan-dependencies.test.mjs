import test from "node:test";
import assert from "node:assert/strict";
import { canAddDependency, wouldCreateCycle, cascadeAfterMove } from "../dist/index.js";

const item = (id, start, end, status = "PLANNED", projectId = "p1") => ({ id, projectId, plannedStart: start, plannedEnd: end, status });
const link = (predecessorId, successorId) => ({ predecessorId, successorId });

test("a successor starting on the day after the predecessor ends is not moved", () => {
  const items = [item("a", "2026-03-01", "2026-03-05"), item("b", "2026-03-06", "2026-03-10")];
  assert.deepEqual(cascadeAfterMove(items, [link("a", "b")], "a"), { moves: [], blocked: [] });
});

test("moving the predecessor later pushes the successor by the least days needed, keeping its length", () => {
  const items = [item("a", "2026-03-10", "2026-03-14"), item("b", "2026-03-06", "2026-03-10")];
  const { moves, blocked } = cascadeAfterMove(items, [link("a", "b")], "a");
  assert.deepEqual(moves, [{ id: "b", plannedStart: "2026-03-15", plannedEnd: "2026-03-19", causedBy: "a" }]);
  assert.deepEqual(blocked, []);
});

test("moving the predecessor earlier never pulls the successor earlier", () => {
  const items = [item("a", "2026-03-01", "2026-03-02"), item("b", "2026-03-20", "2026-03-25")];
  assert.deepEqual(cascadeAfterMove(items, [link("a", "b")], "a").moves, []);
});

test("the push carries through a chain of successors", () => {
  const items = [item("a", "2026-03-01", "2026-03-10"), item("b", "2026-03-05", "2026-03-06"), item("c", "2026-03-07", "2026-03-08")];
  const { moves } = cascadeAfterMove(items, [link("a", "b"), link("b", "c")], "a");
  assert.deepEqual(moves.map((m) => [m.id, m.plannedStart, m.causedBy]), [
    ["b", "2026-03-11", "a"],
    ["c", "2026-03-13", "b"],
  ]);
});

test("a diamond keeps the later constraint from either route", () => {
  // a → b, a → c, b → d and c → d. d must start after both b and c end.
  const items = [
    item("a", "2026-03-01", "2026-03-20"),
    item("b", "2026-03-10", "2026-03-11"),
    item("c", "2026-03-10", "2026-03-25"),
    item("d", "2026-03-12", "2026-03-13"),
  ];
  const links = [link("a", "b"), link("a", "c"), link("b", "d"), link("c", "d")];
  const moved = Object.fromEntries(cascadeAfterMove(items, links, "a").moves.map((m) => [m.id, m.plannedStart]));
  assert.equal(moved.c, "2026-03-21");
  assert.equal(moved.b, "2026-03-21");
  // c ends 2026-04-05 after the move, so d must start on 2026-04-06, the later of the two routes.
  assert.equal(moved.d, "2026-04-06");
});

test("a DONE successor is reported as blocked, not moved", () => {
  const items = [item("a", "2026-03-01", "2026-03-10"), item("b", "2026-03-05", "2026-03-06", "DONE")];
  const { moves, blocked } = cascadeAfterMove(items, [link("a", "b")], "a");
  assert.deepEqual(moves, []);
  assert.deepEqual(blocked, [{ id: "b", reason: "DONE", causedBy: "a" }]);
});

test("a cancelled successor is reported as blocked, and its own successors are not moved through it", () => {
  const items = [item("a", "2026-03-01", "2026-03-10"), item("b", "2026-03-05", "2026-03-06", "CANCELLED"), item("c", "2026-03-07", "2026-03-08")];
  const { moves, blocked } = cascadeAfterMove(items, [link("a", "b"), link("b", "c")], "a");
  assert.deepEqual(moves, []);
  assert.deepEqual(blocked, [{ id: "b", reason: "CANCELLED", causedBy: "a" }]);
});

test("a self link, a duplicate link and a loop are refused", () => {
  const items = [item("a", "2026-03-01", "2026-03-02"), item("b", "2026-03-03", "2026-03-04"), item("c", "2026-03-05", "2026-03-06")];
  assert.equal(canAddDependency([], items, "a", "a").ok, false);
  assert.equal(canAddDependency([link("a", "b")], items, "a", "b").ok, false);
  const chain = [link("a", "b"), link("b", "c")];
  const loop = canAddDependency(chain, items, "c", "a");
  assert.equal(loop.ok, false);
  assert.match(loop.error.message, /loop/);
  assert.equal(wouldCreateCycle(chain, "c", "a"), true);
  assert.equal(wouldCreateCycle(chain, "a", "c"), false);
});

test("a link across projects is refused, and an unknown activity is not found", () => {
  const items = [item("a", "2026-03-01", "2026-03-02"), item("b", "2026-03-03", "2026-03-04", "PLANNED", "p2")];
  const cross = canAddDependency([], items, "a", "b");
  assert.equal(cross.ok, false);
  assert.match(cross.error.message, /same project/);
  assert.equal(canAddDependency([], items, "a", "zzz").ok, false);
});

test("a valid link is accepted and returned", () => {
  const items = [item("a", "2026-03-01", "2026-03-02"), item("b", "2026-03-03", "2026-03-04")];
  const res = canAddDependency([], items, "a", "b");
  assert.deepEqual(res, { ok: true, value: { predecessorId: "a", successorId: "b" } });
});
