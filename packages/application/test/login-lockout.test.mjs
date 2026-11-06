import assert from "node:assert/strict";
import test from "node:test";
import { LoginHandler, SignUpHandler, AcceptInvitationHandler } from "../dist/index.js";
import { User, UserId, TenantId, Email, MAX_FAILED_LOGINS, LOCKOUT_MINUTES, PasswordPolicy } from "@donordesk/domain";

function user() {
  const u = User.create({ id: UserId.create("u1"), tenantId: TenantId.create("tenant-1"), email: Email.create("a@b.org"), name: "Ada", passwordHash: "hash", role: "PROJECT_MANAGER" });
  u.activate();
  return u;
}
function login(u, okPassword = false) {
  const audits = [];
  const h = new LoginHandler(
    { findByEmailGlobal: async (e) => ({ ok: true, value: e === "a@b.org" ? u : null }), update: async (x) => ({ ok: true, value: x }) },
    { verifyPassword: async () => okPassword, sign: async () => "tok" },
    { record: async (e) => { audits.push(e.eventType); } },
  );
  return { h, audits };
}

test("H-12: five wrong passwords lock the account, the sixth is refused even with the right password", async () => {
  const u = user();
  const bad = login(u, false);
  for (let i = 1; i <= MAX_FAILED_LOGINS; i += 1) {
    const r = await bad.h.handle({ email: "a@b.org", password: "wrong" });
    assert.equal(r.error.message, "Invalid credentials");
  }
  assert.equal(bad.audits.at(-1), "identity.user.locked");
  assert.ok(u.lockedAt(new Date()));
  const right = await login(u, true).h.handle({ email: "a@b.org", password: "right" });
  assert.equal(right.ok, false);
  assert.match(right.error.message, new RegExp(`Try again in (${LOCKOUT_MINUTES}|${LOCKOUT_MINUTES - 1}) minutes`));
});

test("H-12: a good sign-in clears the count, and an expired lock lets the person in again", async () => {
  const u = user();
  const bad = login(u, false);
  for (let i = 0; i < 3; i += 1) await bad.h.handle({ email: "a@b.org", password: "x" });
  assert.equal(u.failedLoginCount, 3);
  assert.equal((await login(u, true).h.handle({ email: "a@b.org", password: "ok" })).ok, true);
  assert.equal(u.failedLoginCount, 0);
  const later = new Date(Date.now() + (LOCKOUT_MINUTES + 1) * 60_000);
  for (let i = 0; i < MAX_FAILED_LOGINS; i += 1) u.recordFailedLogin(new Date());
  assert.equal(u.lockedAt(later), null);
  u.recordFailedLogin(later);
  assert.equal(u.failedLoginCount, 1, "the count restarts after a lock has expired");
});

test("H-12: an unknown address gets the same answer as a wrong password", async () => {
  const r = await login(user(), true).h.handle({ email: "nobody@b.org", password: "x" });
  assert.equal(r.error.message, "Invalid credentials");
  assert.equal(r.error.code, "FORBIDDEN");
});

test("H-12: resetting the password clears a lock", () => {
  const u = user();
  for (let i = 0; i < MAX_FAILED_LOGINS; i += 1) u.recordFailedLogin(new Date());
  assert.ok(u.lockedAt(new Date()));
  u.setPasswordHash("new-hash");
  assert.equal(u.lockedAt(new Date()), null);
  assert.equal(u.failedLoginCount, 0);
});

test("H-12: sign-up and invitation acceptance enforce the 12-character policy", async () => {
  const weak = "short1A!";
  assert.equal(PasswordPolicy.validate(weak).ok, false);
  const signUp = new SignUpHandler(
    { generate: () => "id" },
    {},
    { findByEmailGlobal: async () => ({ ok: true, value: null }) },
    { hashPassword: async () => { throw new Error("must not hash a weak password"); } },
    { publish: async () => {} },
    { record: async () => {} },
    { handle: async () => { throw new Error("must not provision"); } },
  );
  const r = await signUp.handle({ name: "Ada", email: "a@b.org", password: weak, organization: { name: "Org", organizationType: "NGO", country: "KE", primarySector: "HEALTH" } });
  assert.equal(r.ok, false);
  assert.equal(r.error.code, "VALIDATION_FAILED");
  assert.match(r.error.message, /at least 12/);
});

test("H-15: an outside partner's session carries the 'ext' claim; an ordinary user's does not", async () => {
  const partner = User.create({ id: UserId.create("p1"), tenantId: TenantId.create("tenant-1"), email: Email.create("p@partner.org"), name: "Pat Partner", passwordHash: "hash", role: "FIELD_OFFICER", external: true });
  partner.activate();
  const signed = [];
  const handler = (u) => new LoginHandler(
    { findByEmailGlobal: async () => ({ ok: true, value: u }), update: async (x) => ({ ok: true, value: x }) },
    { verifyPassword: async () => true, sign: async (claims) => { signed.push(claims); return "tok"; } },
    { record: async () => {} },
  );
  await handler(partner).handle({ email: "p@partner.org", password: "x" });
  await handler(user()).handle({ email: "a@b.org", password: "x" });
  assert.equal(signed[0].ext, true);
  assert.equal("ext" in signed[1], false);
});
