import test from "node:test";
import assert from "node:assert/strict";
import { todayInZone } from "../../src/features/workplan/domain/today-in-zone.ts";

// 21:30 UTC on 20 Oct is already 21 Oct in Addis Ababa (UTC+3) and still 20 Oct in UTC.
const now = new Date("2026-10-20T21:30:00Z");

test("the day is read in the given zone", () => {
  assert.equal(todayInZone(now, "Africa/Addis_Ababa"), "2026-10-21");
  assert.equal(todayInZone(now, "UTC"), "2026-10-20");
});

test("a missing or unknown zone reads as UTC", () => {
  assert.equal(todayInZone(now), "2026-10-20");
  assert.equal(todayInZone(now, ""), "2026-10-20");
  assert.equal(todayInZone(now, "Not/AZone"), "2026-10-20");
});
