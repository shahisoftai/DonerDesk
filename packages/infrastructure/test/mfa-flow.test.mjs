import assert from "node:assert/strict";
import test from "node:test";
import { LoginHandler, CompleteMfaLoginHandler, BeginMfaEnrollmentHandler, EnableMfaHandler, DisableMfaHandler, ResetUserMfaHandler, GetMfaStatusHandler } from "@donordesk/application";
import { User, UserId, TenantId, Email, MAX_FAILED_LOGINS } from "@donordesk/domain";
import { TotpMfaService, hotp, base32Decode, timeStep } from "../dist/auth/totp-mfa-service.js";

process.env.JWT_SECRET ??= "test-secret-that-is-at-least-32-characters";
const mfa = new TotpMfaService();
const tenantId = TenantId.create("tenant-1");
const ok = (value) => ({ ok: true, value });

function world() {
  const user = User.create({ id: UserId.create("u1"), tenantId, email: Email.create("ada@example.org"), name: "Ada Lovelace", passwordHash: "hash:Correct-Horse-9-Battery", role: "PROJECT_MANAGER" });
  user.activate();
  const admin = User.create({ id: UserId.create("admin"), tenantId, email: Email.create("admin@example.org"), name: "The Admin", passwordHash: "x", role: "ADMIN" });
  admin.activate();
  const all = new Map([["u1", user], ["admin", admin]]);
  const audits = [];
  const users = {
    findByEmailGlobal: async (e) => ok([...all.values()].find((u) => u.email.toString() === e) ?? null),
    findById: async (id) => ok(all.get(id) ?? null),
    update: async (u) => ok(u),
  };
  const auth = { verifyPassword: async (p, h) => h === `hash:${p}`, sign: async (c) => `token-for-${c.sub}` };
  const audit = { record: async (e) => { audits.push(e.eventType); } };
  const ctx = (id = "u1", role = "PROJECT_MANAGER") => ({ tenant: { tenantId, userId: id, role }, requestId: "r" });
  return { user, admin, audits, ctx, login: new LoginHandler(users, auth, audit, mfa), complete: new CompleteMfaLoginHandler(users, auth, mfa, audit),
    begin: new BeginMfaEnrollmentHandler(users, mfa), enable: new EnableMfaHandler(users, mfa, audit), disable: new DisableMfaHandler(users, auth, mfa, audit),
    reset: new ResetUserMfaHandler(users, audit), status: new GetMfaStatusHandler(users) };
}
const codeNow = (secret, offset = 0) => hotp(base32Decode(secret), timeStep(new Date()) + offset);

async function enrolled(w) {
  const { secret } = (await w.begin.handle(w.ctx())).value;
  const { recoveryCodes } = (await w.enable.handle(w.ctx(), codeNow(secret))).value;
  return { secret, recoveryCodes };
}

test("MFA: enrolment needs a code from the app, then turns on and hands out recovery codes once", async () => {
  const w = world();
  assert.equal((await w.status.handle(w.ctx())).value.enabled, false);
  const begun = (await w.begin.handle(w.ctx())).value;
  assert.match(begun.otpauthUri, /^otpauth:\/\/totp\/DonorDesk%3Aada%40example\.org\?secret=/);
  assert.equal(w.user.mfaEnabled, false, "a shown secret protects nothing yet");
  const wrong = await w.enable.handle(w.ctx(), "000000");
  assert.equal(wrong.ok, false);
  assert.match(wrong.error.message, /not right/);
  const done = await w.enable.handle(w.ctx(), codeNow(begun.secret));
  assert.equal(done.value.recoveryCodes.length, 8);
  assert.equal(w.user.mfaEnabled, true);
  assert.deepEqual((await w.status.handle(w.ctx())).value.recoveryCodesLeft, 8);
  assert.ok(!w.user.mfaSecretEnc.includes(begun.secret), "stored sealed");
  assert.equal((await w.enable.handle(w.ctx(), codeNow(begun.secret, 1))).error.code, "CONFLICT");
  assert.equal((await w.begin.handle(w.ctx())).error.code, "CONFLICT");
  assert.ok(w.audits.includes("identity.mfa.enabled"));
});

test("MFA: with it on, the password gives a challenge, not a session; the code finishes the sign-in", async () => {
  const w = world();
  const { secret } = await enrolled(w);
  const first = (await w.login.handle({ email: "ada@example.org", password: "Correct-Horse-9-Battery" })).value;
  assert.equal(first.mfaRequired, true);
  assert.equal("token" in first, false, "no session before the code");
  const bad = await w.complete.handle({ challenge: first.challenge, code: "123456" });
  assert.equal(bad.ok, false);
  const good = await w.complete.handle({ challenge: first.challenge, code: codeNow(secret, 1) });
  assert.equal(good.ok, true);
  assert.equal(good.value.token, "token-for-u1");
  assert.ok(w.audits.includes("identity.mfa.failed") && w.audits.includes("identity.user.login"));
});

test("MFA: the same code cannot be used twice, and a code older than the last one used is refused too", async () => {
  const w = world();
  const { secret } = await enrolled(w);
  const challenge = () => w.login.handle({ email: "ada@example.org", password: "Correct-Horse-9-Battery" }).then((r) => r.value.challenge);
  const code = codeNow(secret, 1);
  assert.equal((await w.complete.handle({ challenge: await challenge(), code })).ok, true);
  assert.equal((await w.complete.handle({ challenge: await challenge(), code })).ok, false, "replayed");
  assert.equal((await w.complete.handle({ challenge: await challenge(), code: codeNow(secret, 0) })).ok, false, "an earlier step than the last one used");
  assert.equal((await w.complete.handle({ challenge: await challenge(), code: codeNow(secret, 1) })).ok, false, "still the same step");
});

test("MFA: a recovery code signs in once and is then gone", async () => {
  const w = world();
  const { recoveryCodes } = await enrolled(w);
  const challenge = () => w.login.handle({ email: "ada@example.org", password: "Correct-Horse-9-Battery" }).then((r) => r.value.challenge);
  assert.equal((await w.complete.handle({ challenge: await challenge(), code: recoveryCodes[0] })).ok, true);
  assert.equal((await w.complete.handle({ challenge: await challenge(), code: recoveryCodes[0] })).ok, false);
  assert.equal(w.user.mfaRecoveryHashes.length, 7);
  assert.equal((await w.complete.handle({ challenge: await challenge(), code: recoveryCodes[1].toUpperCase() })).ok, true, "case does not matter");
});

test("MFA: wrong codes count toward the lockout, and a locked account refuses even a right code", async () => {
  const w = world();
  const { secret } = await enrolled(w);
  const challenge = (await w.login.handle({ email: "ada@example.org", password: "Correct-Horse-9-Battery" })).value.challenge;
  for (let i = 0; i < MAX_FAILED_LOGINS; i += 1) await w.complete.handle({ challenge, code: "000000" });
  assert.ok(w.audits.includes("identity.user.locked"));
  const locked = await w.complete.handle({ challenge, code: codeNow(secret, 3) });
  assert.equal(locked.ok, false);
  assert.match(locked.error.message, /Too many failed/);
});

test("MFA: an expired, forged or foreign challenge is refused; a challenge is not a session", async () => {
  const w = world();
  await enrolled(w);
  assert.equal((await w.complete.handle({ challenge: "garbage", code: "123456" })).ok, false);
  const stale = mfa.issueChallenge("u1", "tenant-1", new Date(Date.now() - 10 * 60_000));
  assert.match((await w.complete.handle({ challenge: stale, code: "123456" })).error.message, /took too long/);
  const forUnenrolled = mfa.issueChallenge("admin", "tenant-1", new Date());
  assert.equal((await w.complete.handle({ challenge: forUnenrolled, code: "123456" })).ok, false, "a user without two-step cannot be 'completed'");
});

test("MFA: turning it off needs the password and a code; an admin can clear a lost phone", async () => {
  const w = world();
  const { secret } = await enrolled(w);
  assert.equal((await w.disable.handle(w.ctx(), { password: "wrong", code: codeNow(secret, 1) })).ok, false);
  assert.equal((await w.disable.handle(w.ctx(), { password: "Correct-Horse-9-Battery", code: "000000" })).ok, false);
  assert.equal(w.user.mfaEnabled, true);
  assert.equal((await w.disable.handle(w.ctx(), { password: "Correct-Horse-9-Battery", code: codeNow(secret, 1) })).ok, true);
  assert.equal(w.user.mfaEnabled, false);

  const again = await enrolled(w);
  assert.ok(again.secret);
  await assert.rejects(w.reset.handle(w.ctx("u1", "PROJECT_MANAGER"), "u1"), "a manager cannot reset someone's two-step");
  assert.equal((await w.reset.handle(w.ctx("admin", "ADMIN"), "u1")).ok, true);
  assert.equal(w.user.mfaEnabled, false);
  assert.ok(w.audits.includes("identity.mfa.reset_by_admin"));
  // ...and with it off, the password alone signs in again.
  assert.equal("token" in (await w.login.handle({ email: "ada@example.org", password: "Correct-Horse-9-Battery" })).value, true);
});

test("MFA: without two-step sign-in nothing changes for the person", async () => {
  const w = world();
  const r = await w.login.handle({ email: "ada@example.org", password: "Correct-Horse-9-Battery" });
  assert.equal(r.value.token, "token-for-u1");
  const noMfaService = new LoginHandler({ findByEmailGlobal: async () => ok((await enrolledUser(w))) , update: async (u) => ok(u) }, { verifyPassword: async () => true, sign: async () => "t" }, { record: async () => {} });
  async function enrolledUser(world2) { await enrolled(world2); return world2.user; }
  assert.equal("token" in (await noMfaService.handle({ email: "ada@example.org", password: "x" })).value, true, "a deployment without the MFA service keeps the old behaviour");
});
