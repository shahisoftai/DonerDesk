import assert from "node:assert/strict";
import test from "node:test";
import { toPdfSafeText } from "../dist/exports/pdf-text.js";

test("what Helvetica can draw is kept; the rest becomes plain text (25.7)", () => {
  assert.equal(toPdfSafeText("Jan 1 – Jan 31 — final, “quoted”, 5 €, café"), "Jan 1 – Jan 31 — final, “quoted”, 5 €, café");
  assert.equal(toPdfSafeText("Sept 1 → Oct 1, ≥ 80%, ≤ 5, ✓ done"), "Sept 1 -> Oct 1, >= 80%, <= 5, v done");
  assert.equal(toPdfSafeText("non‑breaking space and zero​width"), "non-breaking space and zerowidth");
  assert.equal(toPdfSafeText("line one\nline two"), "line one\nline two");
  assert.equal(toPdfSafeText("emoji 😀 and 中文"), "emoji - and --");
});
