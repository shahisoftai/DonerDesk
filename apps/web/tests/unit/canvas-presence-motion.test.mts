import test from "node:test";
import assert from "node:assert/strict";
import { initialsOf, orderPeers, parsePeers } from "../../src/features/canvas/domain/presence.ts";
import { motionChartOption, motionStyle } from "../../src/features/canvas/domain/motion-style.ts";

test("the people also on a canvas: editors first, then by name, each once; initials are never empty", () => {
  const peers = [{ userId: "b", name: "Bo", blockId: null, editing: false }, { userId: "a", name: "Ada Lovelace", blockId: "k", editing: true }, { userId: "b", name: "Bo", blockId: null, editing: false }, { userId: "c", name: "Amir", blockId: null, editing: false }];
  assert.deepEqual(orderPeers(peers).map((p) => p.userId), ["a", "c", "b"]);
  assert.equal(initialsOf("Ada Lovelace"), "AL");
  assert.equal(initialsOf("  bo "), "B");
  assert.equal(initialsOf(""), "?");
});

test("a broken event never breaks the page: anything that is not a list of people is no one", () => {
  assert.deepEqual(parsePeers("not json"), []);
  assert.deepEqual(parsePeers('{"a":1}'), []);
  assert.deepEqual(parsePeers('[{"userId":"a","name":"Ada","blockId":"k","editing":true},{"nope":1},null]'), [{ userId: "a", name: "Ada", blockId: "k", editing: true }]);
});

test("an entrance is CSS only for a fade or a rise, and chart motion is only for bars and lines", () => {
  const fade = { animation: "FADE", durationMs: 400, delayMs: 100, easing: "EASE_OUT" } as const;
  assert.deepEqual(motionStyle(fade), { animationName: "dd-fade", animationDuration: "400ms", animationDelay: "100ms", animationTimingFunction: "ease-out", animationFillMode: "both" });
  assert.equal(motionStyle(undefined), undefined);
  assert.equal(motionStyle({ ...fade, animation: "GROW" }), undefined);
  const option = { series: [] };
  assert.equal(motionChartOption(option, fade), option, "a fade does not touch the chart");
  const grown = motionChartOption(option, { ...fade, animation: "GROW", durationMs: 900, easing: "EASE_IN_OUT" });
  assert.deepEqual([grown.animation, grown.animationDuration, grown.animationDelay, grown.animationEasing], [true, 900, 100, "cubicInOut"]);
  assert.equal((option as { animation?: boolean }).animation, undefined, "the original is not changed");
});
