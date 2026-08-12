import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeSessionPayload } from "../../src/lib/shared/jwt-session.ts";

function makeToken(payload: unknown): string {
  const b64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `header.${b64}.signature`;
}

test("decodes a valid payload", () => {
  const claims = decodeSessionPayload(makeToken({ sub: "u1", tid: "t1", role: "ADMIN", name: "A", email: "a@x.com" }));
  assert.equal(claims?.sub, "u1");
  assert.equal(claims?.role, "ADMIN");
});

test("rejects a malformed token", () => {
  assert.equal(decodeSessionPayload("not-a-token"), null);
  assert.equal(decodeSessionPayload("a.b"), null);
});

test("rejects non-object JSON payload", () => {
  assert.equal(decodeSessionPayload(makeToken("nope")), null);
});

test("rejects garbage base64 payload", () => {
  assert.equal(decodeSessionPayload("a.!!!.c"), null);
});
