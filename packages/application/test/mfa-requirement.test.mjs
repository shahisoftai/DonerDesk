import test from "node:test";
import assert from "node:assert/strict";
import { TenantId } from "@donordesk/domain";
import { UpdateMfaRequirementHandler, GetMfaStatusHandler, DisableMfaHandler } from "../dist/index.js";

const tenantId = TenantId.create("tenant-a");
const ok = (value) => ({ ok: true, value });
const as = (userId, role = "ADMIN") => ({ tenant: { tenantId, userId, role }, requestId: "r" });
const now = new Date("2026-10-10T08:00:00Z");
const clock = { now: () => now };

function world({ adminHasMfa = true, requiredFrom = undefined } = {}) {
  const events = [];
  const org = { id: "o1", mfaRequiredFrom: requiredFrom, setMfaRequiredFrom(f) { this.mfaRequiredFrom = f ?? undefined; } };
  const users = new Map([["admin", { mfaEnabled: adminHasMfa, mfaEnabledAt: now, mfaRecoveryHashes: [] }], ["staff", { mfaEnabled: false, mfaEnabledAt: null, mfaRecoveryHashes: [] }]]);
  return {
    org, events,
    orgs: { findByTenant: async () => ok(org), update: async () => ok(org) },
    usersRepo: { findById: async (id) => ok(users.get(id) ?? null) },
    audit: { record: async (e) => void events.push(e) },
  };
}

test("only an administrator can require it, only after turning it on for themselves, never under single sign-on; the day follows the grace chosen", async () => {
  const w = world();
  const update = new UpdateMfaRequirementHandler(w.orgs, w.usersRepo, w.audit, clock, false);
  assert.equal((await update.handle(as("staff", "PROJECT_MANAGER"), { required: true, graceDays: 7 })).error.code, "FORBIDDEN");
  const on = await update.handle(as("admin"), { required: true, graceDays: 14 });
  assert.equal(on.value.requiredFrom, "2026-10-24T08:00:00.000Z");
  assert.equal(w.org.mfaRequiredFrom.toISOString(), "2026-10-24T08:00:00.000Z");
  assert.equal(w.events[0].eventType, "organization.mfa_required");
  const off = await update.handle(as("admin"), { required: false, graceDays: 7 });
  assert.equal(off.value.requiredFrom, null);
  assert.equal(w.org.mfaRequiredFrom, undefined);
  assert.equal(w.events[1].eventType, "organization.mfa_optional");

  const lockedOut = world({ adminHasMfa: false });
  const refused = await new UpdateMfaRequirementHandler(lockedOut.orgs, lockedOut.usersRepo, lockedOut.audit, clock, false).handle(as("admin"), { required: true, graceDays: 0 });
  assert.match(refused.error.message, /your own account first/);
  assert.equal(lockedOut.org.mfaRequiredFrom, undefined);
  assert.match((await new UpdateMfaRequirementHandler(w.orgs, w.usersRepo, w.audit, clock, true).handle(as("admin"), { required: true, graceDays: 0 })).error.message, /single sign-on/);
});

test("a person is told where they stand: reminded before the day, held to setup from it, done once they have it", async () => {
  const before = world({ requiredFrom: new Date("2026-10-17T08:00:00Z") });
  const status = (w, user) => new GetMfaStatusHandler(w.usersRepo, w.orgs, false, clock.now).handle(as(user));
  assert.equal((await status(before, "staff")).value.requirement, "REQUIRED_SOON");
  assert.equal((await status(before, "admin")).value.requirement, "DONE");
  const after = world({ requiredFrom: new Date("2026-10-01T08:00:00Z") });
  assert.equal((await status(after, "staff")).value.requirement, "SETUP_REQUIRED");
  assert.equal((await status(world(), "staff")).value.requirement, "NOT_REQUIRED");
  assert.equal((await new GetMfaStatusHandler(after.usersRepo, after.orgs, true, clock.now).handle(as("staff"))).value.requirement, "NOT_REQUIRED", "single sign-on owns it");
});

test("while the organisation requires it, a person cannot turn it off", async () => {
  const users = { findById: async () => ok({ mfaEnabled: true, passwordHash: "h", disableMfa() {}, id: { toString: () => "admin" } }), update: async () => ok() };
  const auth = { verifyPassword: async () => true };
  const mfa = { matchingStep: () => 1, decrypt: () => "s", encrypt: () => "e" };
  const required = world({ requiredFrom: new Date("2026-10-01T08:00:00Z") });
  const r = await new DisableMfaHandler(users, auth, mfa, required.audit, required.orgs).handle(as("admin"), { password: "pw", code: "123456" });
  assert.match(r.error.message, /requires two-step sign-in/);
  const notYet = world({ requiredFrom: new Date("2099-01-01T00:00:00Z") });
  const r2 = await new DisableMfaHandler(users, auth, mfa, notYet.audit, notYet.orgs).handle(as("admin"), { password: "pw", code: "123456" });
  assert.ok(!/requires two-step/.test(String(r2.error?.message)));
});
