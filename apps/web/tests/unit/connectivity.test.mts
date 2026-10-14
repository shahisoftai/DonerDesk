import { test } from "node:test";
import assert from "node:assert/strict";
import { guardNetwork, isOfflineFailure } from "../../src/lib/shared/connectivity.ts";

test("offline: the call is not attempted and the answer is a retryable 'unavailable'", async () => {
  let called = false;
  const r = await guardNetwork(async () => { called = true; return { ok: true as const, value: 1 }; }, () => false);
  assert.equal(called, false);
  assert.equal(r.ok, false);
  assert.equal(!r.ok && r.error.kind === "unavailable" && r.error.retryable, true);
  assert.equal(!r.ok && isOfflineFailure(r.error), true);
});

test("a dropped request becomes the same answer; the server's own answers pass through unchanged", async () => {
  const dropped = await guardNetwork(async () => { throw new TypeError("Failed to fetch"); }, () => true);
  assert.equal(!dropped.ok && dropped.error.kind, "unavailable");
  const refused = await guardNetwork(async () => ({ ok: false as const, error: { kind: "validation" as const, message: "no", fields: {} } }), () => true);
  assert.equal(!refused.ok && refused.error.kind, "validation");
  assert.equal(!refused.ok && isOfflineFailure(refused.error), false);
  const fine = await guardNetwork(async () => ({ ok: true as const, value: 7 }), () => true);
  assert.deepEqual(fine, { ok: true, value: 7 });
});
