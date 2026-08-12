import { test } from "node:test";
import assert from "node:assert/strict";
import { parseProblem, mergeReferenceId } from "../../src/lib/shared/problem.ts";

test("parseProblem maps 400 with field errors to validation", () => {
  const error = parseProblem(400, { title: "Validation failed", errors: [{ path: ["title"], message: "Required" }] });
  assert.equal(error.kind, "validation");
  if (error.kind === "validation") {
    assert.deepEqual(error.fields, { title: ["Required"] });
  }
});

test("parseProblem maps 401 to unauthenticated", () => {
  const error = parseProblem(401, { title: "Invalid token", status: 401 });
  assert.equal(error.kind, "unauthenticated");
});

test("parseProblem maps 403 to forbidden", () => {
  const error = parseProblem(403, { title: "Forbidden" });
  assert.equal(error.kind, "forbidden");
});

test("parseProblem maps 404 to not_found", () => {
  const error = parseProblem(404, { title: "Not found" });
  assert.equal(error.kind, "not_found");
});

test("parseProblem maps 409 to conflict", () => {
  const error = parseProblem(409, { title: "Conflict" });
  assert.equal(error.kind, "conflict");
});

test("parseProblem maps 429 to rate_limited", () => {
  const error = parseProblem(429, { title: "Too many requests" });
  assert.equal(error.kind, "rate_limited");
});

test("parseProblem maps 500 to unavailable non-retryable", () => {
  const error = parseProblem(500, { title: "Internal" });
  assert.equal(error.kind, "unavailable");
  if (error.kind === "unavailable") assert.equal(error.retryable, false);
});

test("parseProblem maps 503 to unavailable retryable", () => {
  const error = parseProblem(503, { title: "Unavailable" });
  assert.equal(error.kind, "unavailable");
  if (error.kind === "unavailable") assert.equal(error.retryable, true);
});

test("parseProblem falls back to HTTP status message for empty body", () => {
  const error = parseProblem(502, null);
  assert.equal(error.kind, "unavailable");
  assert.match(error.message, /502/);
});

test("parseProblem carries requestId as referenceId", () => {
  const error = parseProblem(403, { title: "Forbidden", requestId: "req-123" });
  assert.equal(error.referenceId, "req-123");
});

test("mergeReferenceId only fills an absent referenceId", () => {
  const error = parseProblem(403, { title: "Forbidden" });
  const merged = mergeReferenceId(error, "hdr-1");
  assert.equal(merged.referenceId, "hdr-1");
  const unchanged = mergeReferenceId(merged, "hdr-2");
  assert.equal(unchanged.referenceId, "hdr-1");
});
