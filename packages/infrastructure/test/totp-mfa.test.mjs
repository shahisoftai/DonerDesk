import assert from "node:assert/strict";
import test from "node:test";
import { TotpMfaService, hotp, base32Decode, base32Encode, timeStep } from "../dist/auth/totp-mfa-service.js";

process.env.JWT_SECRET ??= "test-secret-that-is-at-least-32-characters";
const svc = new TotpMfaService();

test("MFA: RFC 4226 and RFC 6238 test vectors", () => {
  const key = Buffer.from("12345678901234567890");
  // RFC 4226 appendix D (6 digits)
  assert.deepEqual([0, 1, 2, 3, 4, 5].map((c) => hotp(key, c)), ["755224", "287082", "359152", "969429", "338314", "254676"]);
  // RFC 6238 appendix B, T=59s (counter 1): 94287082 -> last six digits
  assert.equal(hotp(key, 1), "287082");
  assert.equal(timeStep(new Date(59_000)), 1);
  assert.equal(hotp(key, timeStep(new Date(1111111109_000))), "081804");
});

test("MFA: base32 round-trips and tolerates spaces and case", () => {
  const raw = Buffer.from("hello-mfa-secret!!");
  assert.equal(base32Decode(base32Encode(raw)).toString(), raw.toString());
  assert.equal(base32Decode(base32Encode(raw).toLowerCase().replace(/(.{4})/g, "$1 ")).toString(), raw.toString());
});

test("MFA: a code is accepted for its own step and one either side, nothing else", () => {
  const secret = svc.newSecret();
  const key = base32Decode(secret);
  const now = new Date(1_700_000_000_000);
  const step = timeStep(now);
  assert.equal(svc.matchingStep(secret, hotp(key, step), now), step);
  assert.equal(svc.matchingStep(secret, hotp(key, step - 1), now), step - 1);
  assert.equal(svc.matchingStep(secret, hotp(key, step + 1), now), step + 1);
  assert.equal(svc.matchingStep(secret, hotp(key, step - 2), now), null);
  assert.equal(svc.matchingStep(secret, hotp(key, step + 5), now), null);
  assert.equal(svc.matchingStep(secret, "12345", now), null);
  assert.equal(svc.matchingStep(secret, "abcdef", now), null);
  assert.equal(svc.matchingStep(secret, ` ${hotp(key, step).slice(0, 3)} ${hotp(key, step).slice(3)} `, now), step, "spaces typed in the code are fine");
});

test("MFA: the stored secret is sealed, not readable, and tamper-evident", () => {
  const secret = svc.newSecret();
  const sealed = svc.encrypt(secret);
  assert.ok(!sealed.includes(secret));
  assert.equal(svc.decrypt(sealed), secret);
  assert.notEqual(svc.encrypt(secret), sealed, "a fresh nonce each time");
  const parts = sealed.split(".");
  parts[3] = parts[3].slice(0, -2) + (parts[3].endsWith("AA") ? "BB" : "AA");
  assert.throws(() => svc.decrypt(parts.join(".")));
  assert.throws(() => svc.decrypt("garbage"));
});

test("MFA: the otpauth link carries the secret and names the issuer", () => {
  const uri = svc.otpauthUri("JBSWY3DPEHPK3PXP", "ada@example.org", "DonorDesk");
  assert.match(uri, /^otpauth:\/\/totp\/DonorDesk%3Aada%40example\.org\?secret=JBSWY3DPEHPK3PXP&issuer=DonorDesk&algorithm=SHA1&digits=6&period=30$/);
});

test("MFA: eight distinct recovery codes, stored only as hashes, matched ignoring case and dashes", () => {
  const { codes, hashes } = svc.newRecoveryCodes();
  assert.equal(codes.length, 8);
  assert.equal(new Set(codes).size, 8);
  assert.ok(codes.every((c) => /^[a-z2-7]{5}-[a-z2-7]{5}$/.test(c)));
  assert.deepEqual(hashes, codes.map((c) => svc.hashRecoveryCode(c)));
  assert.equal(svc.hashRecoveryCode(codes[0].toUpperCase().replace("-", " ")), hashes[0]);
  assert.ok(hashes.every((h) => !codes.some((c) => h.includes(c.replace("-", "")))));
});

test("MFA: the challenge proves the password step, expires in five minutes, and cannot be forged", () => {
  const now = new Date("2026-10-22T10:00:00Z");
  const token = svc.issueChallenge("u1", "tenant-a", now);
  assert.deepEqual(svc.readChallenge(token, new Date(now.getTime() + 4 * 60_000)), { userId: "u1", tenantId: "tenant-a" });
  assert.equal(svc.readChallenge(token, new Date(now.getTime() + 6 * 60_000)), null, "expired");
  const [payload] = token.split(".");
  const forged = Buffer.from(JSON.stringify({ u: "admin", t: "tenant-a", e: 9999999999, p: "mfa" })).toString("base64url");
  assert.equal(svc.readChallenge(`${forged}.${token.split(".")[1]}`, now), null, "signature does not cover a changed payload");
  assert.equal(svc.readChallenge(`${payload}.AAAA`, now), null);
  assert.equal(svc.readChallenge("nonsense", now), null);
});
