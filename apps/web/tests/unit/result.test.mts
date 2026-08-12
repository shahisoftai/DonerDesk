import { test } from "node:test";
import assert from "node:assert/strict";
import { ok, err, isOk, isErr } from "../../src/lib/shared/result.ts";

test("ok builds a success result", () => {
  const r = ok(42);
  assert.equal(r.ok, true);
  assert.equal(isOk(r), true);
  if (r.ok) assert.equal(r.value, 42);
});

test("err builds a failure result", () => {
  const r = err({ kind: "not_found", message: "x" });
  assert.equal(r.ok, false);
  assert.equal(isErr(r), true);
  if (!r.ok) assert.equal(r.error.kind, "not_found");
});
