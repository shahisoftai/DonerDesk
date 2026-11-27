import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_STATS_RANGE, STATS_RANGES, changeOf, clickRate, metricOf, notConfiguredSection, okSection, parseStatsRange,
  plainName, ranked, searchRow, shareOf, signUpRate, topPages, topSearchRows, unavailableSection, windowsFor,
} from "../dist/index.js";

test("an unknown range is the default, a known one is kept", () => {
  assert.equal(parseStatsRange("7"), 7);
  assert.equal(parseStatsRange(90), 90);
  for (const bad of ["", "x", "30", null, undefined, -1, "28.5"]) assert.equal(parseStatsRange(bad), DEFAULT_STATS_RANGE);
  assert.deepEqual([...STATS_RANGES], [7, 28, 90]);
});

test("windows are inclusive, equally long, and the previous one ends the day before the current starts", () => {
  const { current, previous } = windowsFor(7, new Date("2026-11-27T15:00:00Z"));
  assert.deepEqual(current, { startDate: "2026-11-21", endDate: "2026-11-27" });
  assert.deepEqual(previous, { startDate: "2026-11-14", endDate: "2026-11-20" });
});

test("a lag moves both windows back (Search Console runs behind)", () => {
  const { current } = windowsFor(28, new Date("2026-11-27T00:00:00Z"), 2);
  assert.equal(current.endDate, "2026-11-25");
  assert.equal(current.startDate, "2026-10-29");
});

test("windows cross a month and a year boundary", () => {
  assert.equal(windowsFor(7, new Date("2027-01-03T10:00:00Z")).current.startDate, "2026-12-28");
});

test("change is null without an earlier figure above zero, never a percentage of nothing", () => {
  assert.equal(changeOf(5, null), null);
  assert.equal(changeOf(5, 0), null);
  assert.equal(changeOf(15, 10), 0.5);
  assert.equal(changeOf(5, 10), -0.5);
  assert.deepEqual(metricOf(3, 0), { value: 3, previous: 0, change: null });
});

test("a share of nothing is null", () => {
  assert.equal(shareOf(1, 0), null);
  assert.equal(shareOf(1, 4), 0.25);
  assert.equal(signUpRate(2, 0), null);
  assert.equal(signUpRate(2, 100), 0.02);
});

test("rankings are biggest first, capped, with shares of the listed total, ties by name", () => {
  const rows = [{ name: "b", visitors: 2 }, { name: "a", visitors: 2 }, { name: "c", visitors: 6 }];
  const out = ranked(rows, 2);
  assert.deepEqual(out.map((r) => r.name), ["c", "a"]);
  assert.equal(out[0].share, 0.6);
  assert.deepEqual(ranked([{ name: "x", visitors: 0 }], 5)[0].share, null);
  assert.equal(rows[0].name, "b", "the input is not reordered");
});

test("pages are ranked by views", () => {
  const out = topPages([{ path: "/b", views: 1, visitors: 1 }, { path: "/a", views: 9, visitors: 3 }], 1);
  assert.deepEqual(out, [{ path: "/a", views: 9, visitors: 3 }]);
});

test("Google's unknown labels become plain words", () => {
  assert.equal(plainName("(not set)"), "Not known");
  assert.equal(plainName("  "), "Not known");
  assert.equal(plainName(undefined), "Not known");
  assert.equal(plainName("Kenya"), "Kenya");
});

test("click rate and position need impressions", () => {
  assert.equal(clickRate(0, 0), null);
  assert.equal(clickRate(1, 50), 0.02);
  assert.deepEqual(searchRow("q", 0, 0, 4.2), { name: "q", clicks: 0, impressions: 0, ctr: null, position: null });
  assert.equal(searchRow("q", 1, 10, 4.2).position, 4.2);
  assert.equal(searchRow("", 1, 10, null).name, "Not known");
  assert.equal(searchRow("q", 1, 10, 0).position, null);
});

test("search rows are ranked by clicks, then impressions", () => {
  const rows = [searchRow("a", 1, 100, 3), searchRow("b", 5, 10, 2), searchRow("c", 5, 50, 9)];
  assert.deepEqual(topSearchRows(rows, 2).map((r) => r.name), ["c", "b"]);
});

test("a section says why it is empty", () => {
  assert.equal(okSection(1).status, "OK");
  assert.deepEqual(notConfiguredSection("no key"), { status: "NOT_CONFIGURED", data: null, note: "no key" });
  assert.equal(unavailableSection("down").data, null);
});

test("daysIn lists every day of a window, inclusive", async () => {
  const { daysIn } = await import("../dist/index.js");
  assert.deepEqual(daysIn({ startDate: "2026-02-27", endDate: "2026-03-02" }), ["2026-02-27", "2026-02-28", "2026-03-01", "2026-03-02"]);
  assert.deepEqual(daysIn({ startDate: "2026-03-02", endDate: "2026-03-01" }), []);
});
