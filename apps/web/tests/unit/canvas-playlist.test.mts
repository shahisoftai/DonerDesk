import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_SECONDS, MAX_PLAYLIST, MAX_SECONDS, MIN_SECONDS, parsePlaylist, secondsOf, stepIndex } from "../../src/features/canvas/domain/playlist.ts";

test("a playlist keeps the order given, drops repeats and anything that is not an id, and holds at most eight", () => {
  assert.deepEqual(parsePlaylist("a1, b2,a1,../x,c3"), ["a1", "b2", "c3"]);
  assert.deepEqual(parsePlaylist(undefined), []);
  assert.equal(parsePlaylist(Array.from({ length: 20 }, (_, i) => `id${i}`).join(",")).length, MAX_PLAYLIST);
});

test("seconds stay inside the allowed range and fall back to the default", () => {
  assert.equal(secondsOf("5"), MIN_SECONDS);
  assert.equal(secondsOf("9999"), MAX_SECONDS);
  assert.equal(secondsOf("45"), 45);
  assert.equal(secondsOf("abc"), DEFAULT_SECONDS);
  assert.equal(secondsOf(undefined), DEFAULT_SECONDS);
});

test("stepping wraps round both ways and an empty list stays at the start", () => {
  assert.equal(stepIndex(2, 3, 1), 0);
  assert.equal(stepIndex(0, 3, -1), 2);
  assert.equal(stepIndex(0, 0, 1), 0);
});
