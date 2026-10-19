import { test } from "node:test";
import assert from "node:assert/strict";
import { waitingLine, dependencyOptions } from "../../src/features/workplan/domain/dependency-view.ts";

test("a wait reads in plain words, listing every unfinished activity", () => {
  assert.equal(waitingLine([]), undefined);
  assert.equal(waitingLine([{ title: "Survey" }]), "Waiting for Survey");
  assert.equal(waitingLine([{ title: "Survey" }, { title: "Training" }, { title: "Procurement" }]), "Waiting for Survey, Training and Procurement");
});

test("the choices exclude the activity itself, cancelled ones, those already linked, and those that wait for it", () => {
  const row = (id: string, start: string, extra = {}) => ({ id, title: `Act ${id}`, status: "PLANNED", plannedStart: start, comesAfter: [], comesBefore: [], ...extra });
  const rows = [
    row("a", "2026-03-10", { comesBefore: [{ id: "d" }] }),
    row("b", "2026-03-01", { comesAfter: [{ id: "c" }] }),
    row("c", "2026-02-01"),
    row("d", "2026-04-01"),
    row("e", "2026-03-05", { status: "CANCELLED" }),
    row("f", "2026-03-05"),
  ];
  assert.deepEqual(dependencyOptions("b", rows).map((o) => o.id), ["f", "a", "d"].sort((x, y) => rows.find((r) => r.id === x).plannedStart.localeCompare(rows.find((r) => r.id === y).plannedStart)).filter((id) => id !== "c"));
  assert.deepEqual(dependencyOptions("a", rows).map((o) => o.id), ["c", "b", "f"]);
});

import { dependencyLinks, elbowPath } from "../../src/features/workplan/domain/dependency-view.ts";

test("an arrow is drawn only when both activities are on the timeline", () => {
  const rows = [
    { id: "b", comesAfter: [{ id: "a", finished: false }, { id: "z", finished: true }] },
    { id: "c", comesAfter: [{ id: "b", finished: false }] },
    { id: "d", comesAfter: [] },
  ];
  assert.deepEqual(dependencyLinks(rows, new Set(["a", "b", "c"])), [
    { fromId: "a", toId: "b", finished: false },
    { fromId: "b", toId: "c", finished: false },
  ]);
  assert.deepEqual(dependencyLinks(rows, new Set(["b"])), [], "a hidden activity draws nothing");
});

test("the arrow leaves the end of the first bar and enters the start of the next, with an elbow", () => {
  const a = { x: 100, y: 0, width: 80, height: 28 };
  const b = { x: 220, y: 32, width: 60, height: 28 };
  assert.equal(elbowPath(a, b), "M 180 14 H 212 V 46 H 220");
  // The next bar starts before the first ends: it still connects, routed between the rows.
  const early = { x: 150, y: 32, width: 60, height: 28 };
  assert.equal(elbowPath(a, early), "M 180 14 H 188 V 30 H 142 V 46 H 150");
});
