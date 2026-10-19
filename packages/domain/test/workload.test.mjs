import test from "node:test";
import assert from "node:assert/strict";
import { weekStartOf, upcomingWeeks, loadInWeek, workloadGrid, parseCapacity, WORKLOAD_WEEKS } from "../dist/index.js";

test("a week starts on its Monday: 19 Oct 2026 is a Monday, and 25 Oct belongs to that week", () => {
  assert.equal(weekStartOf("2026-10-19"), "2026-10-19");
  assert.equal(weekStartOf("2026-10-25"), "2026-10-19");
  assert.equal(weekStartOf("2026-10-18"), "2026-10-12");
  assert.equal(upcomingWeeks("2026-10-21").length, WORKLOAD_WEEKS);
  assert.equal(upcomingWeeks("2026-10-21")[0], "2026-10-19");
});

test("load counts open activities the person leads that overlap the week; done and cancelled do not count", () => {
  const items = [
    { ownerUserId: "amina", plannedStart: "2026-10-21", plannedEnd: "2026-10-23", status: "PLANNED" },
    { ownerUserId: "amina", plannedStart: "2026-10-17", plannedEnd: "2026-10-20", status: "IN_PROGRESS" },
    { ownerUserId: "amina", plannedStart: "2026-10-21", plannedEnd: "2026-10-21", status: "DONE" },
    { ownerUserId: "amina", plannedStart: "2026-10-21", plannedEnd: "2026-10-21", status: "CANCELLED" },
    { ownerUserId: "tomas", plannedStart: "2026-10-21", plannedEnd: "2026-10-21", status: "PLANNED" },
  ];
  assert.equal(loadInWeek(items, "amina", "2026-10-19"), 2);
  assert.equal(loadInWeek(items, "amina", "2026-10-26"), 0);
});

test("an overload is flagged against the person's capacity, and no capacity means no flag", () => {
  const items = [1, 2, 3].map((d) => ({ ownerUserId: "amina", plannedStart: `2026-10-2${d}`, plannedEnd: `2026-10-2${d}`, status: "PLANNED" }));
  const [limited, unlimited] = workloadGrid(items, [{ userId: "amina", capacity: 2 }, { userId: "tomas", capacity: null }], ["2026-10-19"]);
  assert.equal(limited.weeks[0].load, 3);
  assert.equal(limited.weeks[0].over, true);
  assert.equal(unlimited.weeks[0].over, false);
});

test("a capacity is a whole number from 1 to 30, or blank", () => {
  assert.deepEqual(parseCapacity(" 4 "), { ok: true, value: 4 });
  assert.deepEqual(parseCapacity(""), { ok: true, value: null });
  assert.equal(parseCapacity("0").ok, false);
  assert.equal(parseCapacity("2.5").ok, false);
  assert.equal(parseCapacity("31").ok, false);
});
