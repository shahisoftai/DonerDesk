import { test } from "node:test";
import assert from "node:assert/strict";
import { findRawTokens } from "@donordesk/domain/core/copy-lint.js";
import { PLACES_COPY, PLACE_LEVEL_LABEL } from "../../src/features/places/domain/places-copy.ts";

function strings(): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const [key, value] of Object.entries(PLACES_COPY)) {
    if (typeof value === "string") out.push([key, value]);
    else if (typeof value === "function") out.push([key, (value as (...a: number[]) => string)(3, 3)]);
    else for (const [k, v] of Object.entries(value)) out.push([`${key}.${k}`, v]);
  }
  for (const [level, label] of Object.entries(PLACE_LEVEL_LABEL)) out.push([`level.${level}`, label]);
  return out;
}

test("Places copy has no raw code, id or snake_case key", () => {
  for (const [key, text] of strings()) assert.deepEqual(findRawTokens(text), [], `${key}: ${text}`);
});

test("counts agree with their noun", () => {
  assert.equal(PLACES_COPY.importWillAdd(1), "1 place will be added.");
  assert.equal(PLACES_COPY.importWillAdd(2), "2 places will be added.");
  assert.equal(PLACES_COPY.importAdded(1), "1 place was added.");
  assert.equal(PLACES_COPY.importAdded(4), "4 places were added.");
});

test("the screen never says node, admin level or parent", () => {
  for (const [key, text] of strings()) assert.doesNotMatch(text, /\b(node|admin level|parent)\b/i, key);
});
