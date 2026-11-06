// Phase 38.4: the Places slide's pure rules.
import test from "node:test";
import assert from "node:assert/strict";
import { ADMIN_LEVEL_LABEL } from "@donordesk/domain";
import { PLACE_LEVELS, levelLabel, listedNames, parentOptions, placeRows } from "../../src/features/project-setup/pcw/domain/places-view.ts";
import { notUsedAnswer } from "../../src/features/project-setup/pcw/domain/pcw-view.ts";
import { PCW_COPY } from "../../src/features/project-setup/pcw/copy.ts";
import { findRawTokens } from "@donordesk/domain/core/copy-lint.js";

const p = (i: number, name: string, adminLevel: number | null, parentName: string | null = null) =>
  ({ path: `places.${i}`, status: "EDITED", origin: "USER", quote: null, value: { name, adminLevel, parentName, latitude: null, longitude: null } }) as never;

const items = [p(0, "Uganda", 0), p(1, "Northern Region", 1, "Uganda"), p(2, "Gulu District", 2, "Northern Region"), p(3, "Pece", 4, "Gulu District")];

test("the kinds of place are the same words the places list uses everywhere", () => {
  for (const l of PLACE_LEVELS) assert.equal(l.label, ADMIN_LEVEL_LABEL[l.value as 0 | 1 | 2 | 3 | 4]);
  assert.equal(levelLabel(null), "Kind not set");
});

test("each place shows what it sits inside, all the way up", () => {
  assert.deepEqual(placeRows(items).map((r) => r.inside), ["", "Uganda", "Northern Region, Uganda", "Gulu District, Northern Region, Uganda"]);
});

test("a parent loop or a missing parent stops the chain instead of hanging", () => {
  const loop = [p(0, "A", 2, "B"), p(1, "B", 2, "A"), p(2, "C", 4, "Nowhere")];
  assert.deepEqual(placeRows(loop).map((r) => r.inside), ["B", "A", "Nowhere"]);
});

test("a place can only sit inside a wider one, never inside itself", () => {
  assert.deepEqual(parentOptions(items, null, 2), ["Uganda", "Northern Region"]);
  assert.deepEqual(parentOptions(items, items[2]!.value as never, 4), ["Uganda", "Northern Region"]);
  assert.deepEqual(parentOptions(items, null, null), ["Uganda", "Northern Region", "Gulu District", "Pece"]);
});

test("names already on the list are not suggested again", () => {
  assert.equal(listedNames(items).has("gulu district"), true);
  assert.equal(listedNames(items).has("kitgum"), false);
});

test("'not used' and its optional reason are read from the answers", () => {
  const view = { extras: { answers: { "places.decided": { notUsed: true, reason: "Online only" }, "places.area": { notUsed: true } } } } as never;
  assert.deepEqual(notUsedAnswer(view, "places.decided"), { notUsed: true, reason: "Online only" });
  assert.deepEqual(notUsedAnswer(view, "places.area"), { notUsed: true, reason: "" });
  assert.deepEqual(notUsedAnswer(view, "other"), { notUsed: false, reason: "" });
});

test("the words on this slide are plain language", () => {
  const words = Object.values(PCW_COPY.places).map((t) => (typeof t === "function" ? (t as (...a: number[]) => string)(1, 2) : t));
  for (const t of words) assert.deepEqual(findRawTokens(t), [], t);
});
