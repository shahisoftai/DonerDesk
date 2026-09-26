import assert from "node:assert/strict";
import test from "node:test";
import { DomainError, PasswordPolicy, PasswordResetToken, TenantId } from "../dist/index.js";

test("PasswordPolicy accepts a 12+ char password with 3+ classes", () => {
  const r = PasswordPolicy.validate("CorrectHorse!42");
  assert.equal(r.ok, true);
  assert.deepEqual(r.classesCovered.sort(), ["digit", "lower", "symbol", "upper"]);
});

test("PasswordPolicy rejects too-short passwords", () => {
  const r = PasswordPolicy.validate("Abc1!");
  assert.equal(r.ok, false);
  assert.equal(r.errors.some((e) => /at least 12/i.test(e)), true);
});

test("PasswordPolicy rejects passwords with fewer than 3 character classes", () => {
  const r = PasswordPolicy.validate("aaaaaaaaaaaa");
  assert.equal(r.ok, false);
  assert.equal(r.errors.some((e) => /3 of/i.test(e)), true);
});

test("PasswordPolicy rejects passwords containing whitespace", () => {
  const r = PasswordPolicy.validate("Correct Horse!42");
  assert.equal(r.ok, false);
  assert.equal(r.errors.some((e) => /whitespace/i.test(e)), true);
});

test("PasswordPolicy rejects passwords containing control characters", () => {
  const r = PasswordPolicy.validate("CorrectHorse\u0001!42");
  assert.equal(r.ok, false);
  assert.equal(r.errors.some((e) => /control/i.test(e)), true);
});

test("PasswordPolicy rejects passwords exceeding max length", () => {
  const long = "A".repeat(129) + "a1!";
  const r = PasswordPolicy.validate(long);
  assert.equal(r.ok, false);
  assert.equal(r.errors.some((e) => /at most 128/i.test(e)), true);
});

test("PasswordPolicy.assert throws DomainError on invalid", () => {
  assert.throws(() => PasswordPolicy.assert("short"), (e) => e instanceof DomainError && e.code === "VALIDATION_FAILED");
  assert.doesNotThrow(() => PasswordPolicy.assert("CorrectHorse!42"));
});

test("PasswordPolicy.strength returns a numeric score and a label", () => {
  const weak = PasswordPolicy.strength("password");
  assert.equal(weak.score === 0 || weak.score === 1, true);
  const strong = PasswordPolicy.strength("CorrectHorse!42");
  assert.ok(strong.score >= 3);
  assert.equal(strong.label, "Strong");
});

test("PasswordResetToken.create produces a base64url plaintext and SHA-256 hash; expires in 60 minutes by default", () => {
  const future = new Date(Date.now() + 60 * 60_000);
  const { token, plaintextToken } = PasswordResetToken.create({
    id: "tok-1",
    tenantId: TenantId.create("tenant-a"),
    userId: "user-a",
    expiresAt: future,
  });
  assert.match(plaintextToken, /^[A-Za-z0-9_-]+$/);
  assert.equal(token.tokenHash.length, 64);
  assert.equal(token.isExpired(new Date(Date.now() + 60 * 60_000 + 1)), true);
  assert.equal(token.isExpired(new Date()), false);
  assert.equal(token.isUsed(), false);
});

test("PasswordResetToken.consume flips usedAt once; cannot be reused", () => {
  const { token } = PasswordResetToken.create({
    id: "tok-2",
    tenantId: TenantId.create("tenant-a"),
    userId: "user-a",
    expiresAt: new Date(Date.now() + 60_000),
  });
  token.consume();
  assert.equal(token.isUsed(), true);
  assert.throws(() => token.consume(), (e) => e instanceof DomainError && e.code === "INVARIANT_VIOLATION");
});

test("PasswordResetToken.consume on an expired token throws DomainError", () => {
  const { token } = PasswordResetToken.create({
    id: "tok-3",
    tenantId: TenantId.create("tenant-a"),
    userId: "user-a",
    expiresAt: new Date(Date.now() - 1),
  });
  assert.throws(() => token.consume(), (e) => e instanceof DomainError && e.code === "INVARIANT_VIOLATION");
});

test("PasswordResetToken.hash is deterministic and SHA-256", () => {
  const a = PasswordResetToken.hash("the-token");
  const b = PasswordResetToken.hash("the-token");
  assert.equal(a, b);
  assert.equal(a.length, 64);
});
