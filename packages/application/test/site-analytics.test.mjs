import assert from "node:assert/strict";
import test from "node:test";
import { GetWebsiteStatsHandler, StatsSourceNotConfigured, StatsSourceUnavailable } from "../dist/index.js";

const NOW = new Date("2026-11-27T10:00:00Z");
const clock = { now: () => NOW };
const traffic = { visitors: { value: 5, previous: 4, change: 0.25 } };
const search = { clicks: { value: 1, previous: null, change: null } };

function memory() {
  const map = new Map();
  return { get: (k) => map.get(k), set: (k, v) => void map.set(k, v), size: () => map.size };
}

test("both parts read, windows are right, and the answer is remembered", async () => {
  const calls = [];
  const cache = memory();
  const h = new GetWebsiteStatsHandler(
    { read: async (c, p) => (calls.push(["t", c, p]), traffic) },
    { read: async (c, p) => (calls.push(["s", c, p]), search) },
    cache, clock,
  );
  const first = await h.handle("7");
  assert.equal(first.range, 7);
  assert.equal(first.traffic.status, "OK");
  assert.equal(first.search.status, "OK");
  assert.equal(calls.find((c) => c[0] === "t")[1].endDate, "2026-11-27");
  assert.equal(calls.find((c) => c[0] === "s")[1].endDate, "2026-11-25", "search is read two days behind");
  await h.handle("7");
  assert.equal(calls.length, 2, "the second read comes from memory");
  await h.handle("7", { fresh: true });
  assert.equal(calls.length, 4, "fresh skips memory");
});

test("an unknown range reads 28 days", async () => {
  const h = new GetWebsiteStatsHandler({ read: async () => traffic }, { read: async () => search }, memory(), clock);
  assert.equal((await h.handle("nonsense")).range, 28);
});

test("one failing part leaves the other, says why, and is not remembered", async () => {
  const cache = memory();
  let down = true;
  const h = new GetWebsiteStatsHandler(
    { read: async () => { throw new StatsSourceNotConfigured("No Google key is set up."); } },
    { read: async () => { if (down) throw new Error("secret detail: key=abc"); return search; } },
    cache, clock,
  );
  const report = await h.handle(28);
  assert.deepEqual([report.traffic.status, report.traffic.note, report.traffic.data], ["NOT_CONFIGURED", "No Google key is set up.", null]);
  assert.equal(report.search.status, "UNAVAILABLE");
  assert.ok(!report.search.note.includes("secret"), "an unknown error never leaks its text");
  assert.equal(cache.size(), 0);
  down = false;
  assert.equal((await h.handle(28)).search.status, "OK", "a failure is tried again");
});

test("a known unavailable error keeps its own safe message", async () => {
  const h = new GetWebsiteStatsHandler(
    { read: async () => { throw new StatsSourceUnavailable("Google refused the key."); } },
    { read: async () => search }, memory(), clock);
  assert.equal((await h.handle(28)).traffic.note, "Google refused the key.");
});
