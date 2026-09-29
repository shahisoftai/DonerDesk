import assert from "node:assert/strict";
import test from "node:test";
import { TenantId, User, UsageCounter, Email, Invitation, DomainError } from "@donordesk/domain";
import { AcceptInvitationHandler, EntitlementService } from "../dist/index.js";

function fakeAudit() {
  const events = [];
  return { events, record: async (e) => { events.push(e); return { ok: true, value: undefined }; } };
}

function fakeIds(prefix = "id") {
  let n = 0;
  return { generate: () => `${prefix}-${++n}` };
}

function makeEntitlementService(users) {
  return new EntitlementService(
    {
      listEffectiveByTenant: async () => ({
        ok: true,
        value: [{
          id: "g-base",
          tenantId: "tenant-a",
          planCode: "STARTER",
          source: "DEFAULT",
          effectiveFrom: new Date("2026-01-01T00:00:00Z"),
          effectiveUntil: undefined,
          billingSubscriptionId: undefined,
          overrideLimitsJson: null,
          reason: "test",
          createdById: "user-a",
          isEffectiveAt: () => true,
        }],
      }),
      listExpiredTrialGrants: async () => ({ ok: true, value: [] }),
    },
    { findAccessGrantingByTenant: async () => ({ ok: true, value: null }) },
    {
      get: async (tenantId, metric, periodStart) =>
        ({ ok: true, value: UsageCounter.create({ metric, periodStart, used: 0n, reserved: 0n }) }),
    },
    { listByTenant: async () => ({ ok: true, value: [] }) },
    { listByTenant: async () => ({ ok: true, value: users }) },
  );
}

function memberUser(id, role, status = "ACTIVE") {
  const user = User.create({
    id: `${id}-u`,
    tenantId: TenantId.create("tenant-a"),
    email: Email.create(`${id}@example.com`),
    name: `Member ${id}`,
    passwordHash: "hash",
    role,
  });
  if (status === "ACTIVE") user.activate();
  return user;
}

function invitationFixture(overrides = {}) {
  return Invitation.create({
    id: "inv-1",
    tenantId: TenantId.create("tenant-a"),
    email: Email.create("invitee@example.com"),
    role: "PROJECT_MANAGER",
    invitedById: "user-a",
    token: "token-abc123456",
    ...overrides,
  });
}

function handlerFakes({ users = [], invitation = invitationFixture() } = {}) {
  const usersRepo = {
    created: [],
    create: async (u) => { usersRepo.created.push(u); return { ok: true, value: u }; },
    findByEmail: async (email) => ({ ok: true, value: [...users, ...usersRepo.created].find((u) => u.email.toString() === email) ?? null }),
  };
  const invitationsRepo = {
    stored: invitation,
    updated: 0,
    findByToken: async () => ({ ok: true, value: invitation }),
    update: async (inv) => { invitationsRepo.updated += 1; invitationsRepo.stored = inv; return { ok: true, value: inv }; },
  };
  const auth = {
    hashPassword: async (p) => `hash:${p}`,
    sign: async (payload) => `session:${payload.sub}:${payload.role}`,
  };
  const handler = new AcceptInvitationHandler(fakeIds("u"), usersRepo, invitationsRepo, auth, fakeAudit(), makeEntitlementService(users));
  return { handler, usersRepo, invitationsRepo, auth };
}

test("accept-invitation creates the member at the invited role and marks the invitation accepted", async () => {
  const audit = fakeAudit();
  const { handler, usersRepo, invitationsRepo, auth } = handlerFakes();
  // Rebuild handler with the audit fake we can inspect.
  const h = new AcceptInvitationHandler(fakeIds("u"), usersRepo, invitationsRepo, auth, audit, makeEntitlementService([]));
  const result = await h.handle({ token: "token-abc123456", name: "New Member", password: "password123" });
  assert.equal(result.ok, true);
  assert.equal(usersRepo.created.length, 1);
  const created = usersRepo.created[0];
  assert.equal(created.status, "ACTIVE");
  assert.equal(created.role, "PROJECT_MANAGER");
  assert.equal(created.passwordHash, "hash:password123");
  assert.equal(invitationsRepo.stored.isAccepted(), true);
  assert.ok(invitationsRepo.updated >= 1);
  assert.equal(audit.events[0].eventType, "identity.invitation_accepted");
  assert.match(result.value.token, /^session:u-1:PROJECT_MANAGER$/);
});

test("accept-invitation blocks a full-seat tenant (plan limit, SEATS)", async () => {
  const existing = [memberUser("a", "ADMIN"), memberUser("b", "PROJECT_MANAGER")];
  const { handler } = handlerFakes({ users: existing });
  const result = await handler.handle({ token: "token-abc123456", name: "New Member", password: "password123" });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "PLAN_LIMIT_REACHED");
  assert.equal(result.error.details?.resource, "SEATS");
});

test("accept-invitation lets a VIEWER join via the viewer pool even when full seats are exhausted", async () => {
  const existing = [memberUser("a", "ADMIN")];
  const { handler, usersRepo } = handlerFakes({
    users: existing,
    invitation: invitationFixture({ role: "VIEWER", email: Email.create("viewer@example.com") }),
  });
  const result = await handler.handle({ token: "token-abc123456", name: "New Viewer", password: "password123" });
  assert.equal(result.ok, true);
  assert.equal(usersRepo.created[0].role, "VIEWER");
  assert.equal(result.value.role, "VIEWER");
});

test("accept-invitation enforces the viewer cap (STARTER: 2 viewers)", async () => {
  const existing = [
    memberUser("a", "VIEWER"),
    memberUser("b", "VIEWER"),
  ];
  const { handler } = handlerFakes({
    users: existing,
    invitation: invitationFixture({ role: "VIEWER", email: Email.create("viewer3@example.com") }),
  });
  const result = await handler.handle({ token: "token-abc123456", name: "Third Viewer", password: "password123" });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "PLAN_LIMIT_REACHED");
  assert.equal(result.error.details?.resource, "VIEWERS");
});

test("accept-invitation rejects a duplicate email (sign in instead)", async () => {
  const existing = [memberUser("invitee", "PROJECT_MANAGER")];
  // Make the seeded member's email match the invitation's.
  existing[0] = User.create({
    id: "invitee-u",
    tenantId: TenantId.create("tenant-a"),
    email: Email.create("invitee@example.com"),
    name: "Existing Invitee",
    passwordHash: "hash",
    role: "PROJECT_MANAGER",
  });
  existing[0].activate();
  const { handler } = handlerFakes({ users: existing });
  const result = await handler.handle({ token: "token-abc123456", name: "New Member", password: "password123" });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "CONFLICT");
});

test("accept-invitation is single-use (second accept fails, user not created twice)", async () => {
  const invitation = invitationFixture();
  const { handler, usersRepo } = handlerFakes({ invitation });
  const first = await handler.handle({ token: "token-abc123456", name: "New Member", password: "password123" });
  assert.equal(first.ok, true);
  const second = await handler.handle({ token: "token-abc123456", name: "New Member", password: "password123" });
  assert.equal(second.ok, false);
  assert.equal(second.error.code, "INVALID_STATE_TRANSITION");
  assert.equal(usersRepo.created.length, 1);
});

test("accept-invitation rejects an expired invitation", async () => {
  const expired = invitationFixture({ ttlDays: -1 });
  const { handler, usersRepo } = handlerFakes({ invitation: expired });
  const result = await handler.handle({ token: "token-abc123456", name: "New Member", password: "password123" });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "INVALID_STATE_TRANSITION");
  assert.equal(usersRepo.created.length, 0);
});

test("accept-invitation preview returns invite metadata without mutating anything", async () => {
  const { handler, invitationsRepo } = handlerFakes();
  const result = await handler.preview("token-abc123456");
  assert.equal(result.ok, true);
  assert.equal(result.value.email, "invitee@example.com");
  assert.equal(result.value.role, "PROJECT_MANAGER");
  assert.equal(invitationsRepo.updated, 0);
});
