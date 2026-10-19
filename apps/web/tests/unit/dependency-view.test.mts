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
