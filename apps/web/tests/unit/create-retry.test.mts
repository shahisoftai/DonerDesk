import { test } from "node:test";
import assert from "node:assert/strict";
import { retryWhileUnavailable, isRetryable, newIdempotencyKey, fileIdempotencyKey } from "../../src/lib/shared/create-retry.ts";
import type { AppError } from "../../src/lib/shared/app-error.ts";

const ok = (value: string) => ({ ok: true as const, value });
const fail = (error: AppError) => ({ ok: false as const, error });
const timeout: AppError = { kind: "unavailable", message: "The request timed out. Please try again.", retryable: true };

function script<T>(...steps: Array<ReturnType<typeof ok> | ReturnType<typeof fail>>) {
  let calls = 0;
  return { attempt: async () => steps[Math.min(calls++, steps.length - 1)] as never, calls: () => calls };
}
const noWait = { sleep: async () => undefined, waitMs: 0 };

test("a timed-out create is repeated and the repeat's answer is returned (25.6)", async () => {
  const s = script(fail(timeout), fail(timeout), ok("p1"));
  const retries: number[] = [];
  const r = await retryWhileUnavailable(s.attempt, { ...noWait, onRetry: (n) => retries.push(n) });
  assert.deepEqual(r, { ok: true, value: "p1" });
  assert.equal(s.calls(), 3);
  assert.deepEqual(retries, [1, 2]);
});

test("real answers are never repeated: validation, conflict, refusal, a hard server error", async () => {
  const answers: AppError[] = [
    { kind: "validation", message: "x", fields: {} },
    { kind: "conflict", message: "plan limit" },
    { kind: "forbidden", message: "no" },
    { kind: "unavailable", message: "500", retryable: false },
  ];
  for (const error of answers) {
    const s = script(fail(error), ok("never"));
    const r = await retryWhileUnavailable(s.attempt, noWait);
    assert.equal(r.ok, false, error.kind);
    assert.equal(s.calls(), 1, error.kind);
  }
});

test("it gives up after the attempts and returns the last error", async () => {
  const s = script(fail(timeout));
  const r = await retryWhileUnavailable(s.attempt, { ...noWait, attempts: 3 });
  assert.equal(r.ok, false);
  assert.equal(s.calls(), 3);
});

test("a first-try success makes one call and never sleeps", async () => {
  let slept = 0;
  const s = script(ok("p1"));
  await retryWhileUnavailable(s.attempt, { sleep: async () => { slept += 1; } });
  assert.equal(s.calls(), 1);
  assert.equal(slept, 0);
});

test("keys are valid for the API and unique per form", () => {
  const a = newIdempotencyKey();
  const b = newIdempotencyKey();
  assert.notEqual(a, b);
  assert.match(a, /^form-[0-9a-f-]{36}$/);
  assert.match(a, /^[A-Za-z0-9][A-Za-z0-9_:.-]{7,127}$/, "the same rule the API applies");
  assert.equal(isRetryable(timeout), true);
});

test("a file's key is API-valid whatever its name, stable within a visit and different across visits", () => {
  const apiRule = /^[A-Za-z0-9][A-Za-z0-9_:.-]{7,127}$/;
  const visit1 = newIdempotencyKey();
  const visit2 = newIdempotencyKey();
  for (const identity of ["Monthly report (final) – Kisumu.pdf:48213:1760000000000", "ÿ:1:2", "drive:1AbC_dEf-gHiJkLmNoPqRsTuVwXyZ"]) {
    assert.match(fileIdempotencyKey(visit1, identity), apiRule, identity);
  }
  const identity = "report.pdf:100:200";
  assert.equal(fileIdempotencyKey(visit1, identity), fileIdempotencyKey(visit1, identity), "a retry repeats the key");
  assert.notEqual(fileIdempotencyKey(visit1, identity), fileIdempotencyKey(visit1, "other.pdf:100:200"));
  assert.notEqual(fileIdempotencyKey(visit1, identity), fileIdempotencyKey(visit2, identity), "the same file in a later visit is a new upload");
});
