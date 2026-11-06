import { test } from "node:test";
import assert from "node:assert/strict";
import { isAwaitingVerification } from "../../src/features/evidence/domain/awaiting-verification.ts";

test("only files nobody has decided on are selected by 'select all awaiting verification'", () => {
  for (const status of ["UPLOADED", "AI_TAGGED", "PENDING_REVIEW"]) assert.equal(isAwaitingVerification(status), true, status);
});

test("a file with an open correction request, a rejected, an archived and a verified one are not", () => {
  for (const status of ["NEEDS_CORRECTION", "REJECTED", "ARCHIVED", "VERIFIED"]) assert.equal(isAwaitingVerification(status), false, status);
});
