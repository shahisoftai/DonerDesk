import assert from "node:assert/strict";
import test from "node:test";
import { isValidIdempotencyKey, isStorableStatus, idempotencyVerdict, IDEMPOTENCY_TTL_MS, IDEMPOTENCY_PENDING_TIMEOUT_MS } from "../dist/index.js";

test("keys: 8-128 URL-safe characters, never empty or odd", () => {
  for (const ok of ["a1b2c3d4", "3f2a9c1e-7b44-4d0e-9a51-0c6d2e8f1a77", "form:project.new_01", "A".repeat(128)]) assert.equal(isValidIdempotencyKey(ok), true, ok);
  for (const bad of ["", "short", "has space in it", "ünïcode-key-1234", "A".repeat(129), "-leading-dash-1", undefined, null, 42]) assert.equal(isValidIdempotencyKey(bad), false, String(bad));
});

test("only a successful creation is stored", () => {
  assert.deepEqual([200, 201, 204, 299].map(isStorableStatus), [true, true, true, true]);
  assert.deepEqual([199, 300, 400, 409, 500].map(isStorableStatus), [false, false, false, false, false]);
});

test("verdict: a finished record replays for a day, a running one blocks for two minutes, then the key is free", () => {
  const now = new Date("2026-10-06T12:00:00Z");
  const at = (msAgo) => new Date(now.getTime() - msAgo);
  assert.equal(idempotencyVerdict({ state: "DONE", createdAt: at(1000) }, now), "REPLAY");
  assert.equal(idempotencyVerdict({ state: "DONE", createdAt: at(IDEMPOTENCY_TTL_MS + 1) }, now), "FREE");
  assert.equal(idempotencyVerdict({ state: "PENDING", createdAt: at(1000) }, now), "IN_PROGRESS");
  assert.equal(idempotencyVerdict({ state: "PENDING", createdAt: at(IDEMPOTENCY_PENDING_TIMEOUT_MS + 1) }, now), "FREE");
});
