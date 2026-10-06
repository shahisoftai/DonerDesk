import { test } from "node:test";
import assert from "node:assert/strict";
import { semanticsIntro } from "../../src/features/logframe/domain/semantics-copy.ts";

test("the sentence follows the badge's needsReview signal when there is one", () => {
  assert.match(semanticsIntro({ configured: false, needsReview: false }), /^Confirmed/);
  assert.match(semanticsIntro({ configured: true, needsReview: true }), /^Not confirmed yet/);
});

test("without a description it falls back to whether the semantics were configured", () => {
  assert.match(semanticsIntro({ configured: true }), /^Confirmed/);
  assert.match(semanticsIntro({ configured: false }), /^Not confirmed yet/);
});
