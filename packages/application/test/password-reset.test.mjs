import assert from "node:assert/strict";
import test from "node:test";
import { TenantId, Email, User, UserId } from "@donordesk/domain";
import {
  ChangePasswordHandler,
  ConfirmPasswordResetHandler,
  RequestPasswordResetHandler,
} from "../dist/index.js";

function fakeAudit() {
  const events = [];
  return {
    events,
    record: async (e) => {
      events.push(e);
      return { ok: true, value: undefined };
    },
  };
}

function fakeClock(at = new Date("2026-09-01T12:00:00Z")) {
  return { now: () => new Date(at.getTime()) };
}

function fakeIds() {
  let n = 0;
  return { generate: () => `id-${++n}` };
}

function fakeAuth() {
  const hashed = new Map();
  hashed.set("hash:OldPass!2024", "OldPass!2024");
  return {
    hashes: hashed,
    hashPassword: async (plain) => {
      const h = `hash:${plain}`;
      hashed.set(h, plain);
      return h;
    },
    verifyPassword: async (plain, hash) => hashed.get(hash) === plain,
  };
}

function makeUser(overrides = {}) {
  return User.rehydrate({
    id: UserId.create(overrides.id ?? "user-1"),
    tenantId: TenantId.create(overrides.tenantId ?? "tenant-a"),
    createdAt: new Date("2026-01-01T00:00:00Z"),
    props: {
      email: Email.create(overrides.email ?? "u@example.org"),
      name: overrides.name ?? "User",
      passwordHash: overrides.passwordHash ?? "hash:OldPass!2024",
      role: overrides.role ?? "ADMIN",
      status: overrides.status ?? "ACTIVE",
      lastLoginAt: undefined,
      assignedProjectIds: [],
      passwordChangedAt: overrides.passwordChangedAt ?? null,
    },
  });
}

function context(overrides = {}) {
  return {
    tenant: { tenantId: TenantId.create("tenant-a"), userId: "user-1", role: "ADMIN" },
    requestId: "req-1",
    ipAddress: "127.0.0.1",
    ...overrides,
  };
}

test("ChangePasswordHandler rejects wrong current password", async () => {
  const audit = fakeAudit();
  const auth = fakeAuth();
  let captured = null;
  const users = {
    findById: async () => ({ ok: true, value: makeUser() }),
    updatePasswordHash: async (id, tid, hash) => { captured = { id, tid: tid.toString(), hash }; return { ok: true, value: makeUser({ passwordHash: hash }) }; },
  };
  const handler = new ChangePasswordHandler(users, auth, audit, fakeClock());
  const result = await handler.handle(context(), { currentPassword: "WrongPass!2024", newPassword: "CorrectHorse!42" });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "FORBIDDEN");
  assert.equal(captured, null);
  assert.equal(audit.events.some((e) => e.eventType === "auth.password.change_failed"), true);
});

test("ChangePasswordHandler rejects weak new password", async () => {
  const audit = fakeAudit();
  const auth = fakeAuth();
  const users = { findById: async () => ({ ok: true, value: makeUser() }), updatePasswordHash: async () => ({ ok: true, value: makeUser() }) };
  const handler = new ChangePasswordHandler(users, auth, audit, fakeClock());
  const result = await handler.handle(context(), { currentPassword: "OldPass!2024", newPassword: "password" });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "VALIDATION_FAILED");
});

test("ChangePasswordHandler succeeds and bumps passwordChangedAt", async () => {
  const audit = fakeAudit();
  const auth = fakeAuth();
  let lastHash = null;
  const users = {
    findById: async () => ({ ok: true, value: makeUser() }),
    updatePasswordHash: async (id, tid, hash) => {
      lastHash = hash;
      const u = makeUser({ passwordHash: hash, passwordChangedAt: new Date("2026-09-01T12:00:00Z") });
      return { ok: true, value: u };
    },
  };
  const handler = new ChangePasswordHandler(users, auth, audit, fakeClock());
  const result = await handler.handle(context(), { currentPassword: "OldPass!2024", newPassword: "NewPass!2026Secure" });
  assert.equal(result.ok, true);
  assert.match(lastHash ?? "", /^hash:NewPass!2026Secure$/);
  const types = audit.events.map((e) => e.eventType);
  assert.ok(types.includes("auth.password.changed"));
  assert.ok(types.includes("auth.session.invalidated"));
});

test("ChangePasswordHandler rejects when user missing", async () => {
  const users = { findById: async () => ({ ok: true, value: null }), updatePasswordHash: async () => ({ ok: true, value: null }) };
  const handler = new ChangePasswordHandler(users, fakeAuth(), fakeAudit(), fakeClock());
  const result = await handler.handle(context(), { currentPassword: "OldPass!2024", newPassword: "NewPass!2026Secure" });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "NOT_FOUND");
});

test("RequestPasswordResetHandler always returns accepted; no token when user not found", async () => {
  const audit = fakeAudit();
  const notifyCalls = [];
  const notify = { notify: async (i) => { notifyCalls.push(i); } };
  const rateLimiter = { check: async () => true };
  const users = { findByEmailGlobal: async () => ({ ok: true, value: null }) };
  const tokens = { create: async () => ({ ok: true, value: null }), findActiveByHash: async () => ({ ok: true, value: null }), markUsed: async () => ({ ok: true, value: null }) };
  const handler = new RequestPasswordResetHandler(fakeIds(), users, tokens, rateLimiter, audit, notify, fakeClock(), { webBaseUrl: "https://app.example.org" });
  const result = await handler.handle({ email: "ghost@example.org", ipAddress: "127.0.0.1" });
  assert.equal(result.ok, true);
  assert.equal(notifyCalls.length, 0);
  assert.equal(audit.events.some((e) => e.eventType === "auth.password.reset_requested" && JSON.parse(e.newValue ?? "{}").userFound === false), true);
});

test("RequestPasswordResetHandler creates a token and notifies when user found", async () => {
  const audit = fakeAudit();
  const notifyCalls = [];
  const notify = { notify: async (i) => { notifyCalls.push(i); } };
  const rateLimiter = { check: async () => true };
  let createdToken = null;
  const user = makeUser({ id: "user-1", tenantId: "tenant-a", email: "found@example.org" });
  const users = { findByEmailGlobal: async () => ({ ok: true, value: user }) };
  const tokens = {
    create: async (t) => { createdToken = t; return { ok: true, value: t }; },
    findActiveByHash: async () => ({ ok: true, value: null }),
    markUsed: async () => ({ ok: true, value: null }),
  };
  const handler = new RequestPasswordResetHandler(fakeIds(), users, tokens, rateLimiter, audit, notify, fakeClock(), { webBaseUrl: "https://app.example.org" });
  const result = await handler.handle({ email: "Found@Example.org", ipAddress: "1.2.3.4" });
  assert.equal(result.ok, true);
  assert.notEqual(createdToken, null);
  assert.equal(notifyCalls.length, 1);
  assert.equal(notifyCalls[0].type, "PASSWORD_RESET");
  assert.match(audit.events.find((e) => e.eventType === "auth.password.reset_requested").newValue ?? "", /userFound":true/);
});

test("RequestPasswordResetHandler rate-limits by IP without revealing", async () => {
  const audit = fakeAudit();
  const notify = { notify: async () => {} };
  let count = 0;
  const rateLimiter = { check: async () => { count += 1; return false; } };
  const tokens = { create: async () => ({ ok: true, value: null }), findActiveByHash: async () => ({ ok: true, value: null }), markUsed: async () => ({ ok: true, value: null }) };
  const users = { findByEmailGlobal: async () => ({ ok: true, value: null }) };
  const handler = new RequestPasswordResetHandler(fakeIds(), users, tokens, rateLimiter, audit, notify, fakeClock(), { webBaseUrl: "https://app.example.org" });
  const result = await handler.handle({ email: "x@y.org", ipAddress: "1.2.3.4" });
  assert.equal(result.ok, true);
  assert.equal(count, 1);
  assert.equal(audit.events.some((e) => e.eventType === "auth.password.reset_rate_limited"), true);
});

test("ConfirmPasswordResetHandler rejects when token not found", async () => {
  const users = { findByIdGlobal: async () => ({ ok: true, value: null }), updatePasswordHash: async () => ({ ok: true, value: null }) };
  const tokens = { findActiveByHash: async () => ({ ok: true, value: null }), markUsed: async () => ({ ok: true, value: null }) };
  const handler = new ConfirmPasswordResetHandler(users, tokens, fakeAuth(), fakeAudit(), fakeClock());
  const result = await handler.handle({ token: "x".repeat(40), newPassword: "CorrectHorse!42", ipAddress: "1.1.1.1" });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "VALIDATION_FAILED");
});

test("ConfirmPasswordResetHandler rejects expired token", async () => {
  const audit = fakeAudit();
  const { PasswordResetToken } = await import("@donordesk/domain");
  const expired = PasswordResetToken.create({
    id: "tok-exp",
    tenantId: TenantId.create("tenant-a"),
    userId: "user-1",
    expiresAt: new Date("2026-09-01T11:59:59Z"),
  }).token;
  const users = { findByIdGlobal: async () => ({ ok: true, value: null }), updatePasswordHash: async () => ({ ok: true, value: null }) };
  const tokens = { findActiveByHash: async () => ({ ok: true, value: expired }), markUsed: async () => ({ ok: true, value: expired }) };
  const handler = new ConfirmPasswordResetHandler(users, tokens, fakeAuth(), audit, fakeClock(new Date("2026-09-01T12:00:00Z")));
  const result = await handler.handle({ token: "x".repeat(40), newPassword: "CorrectHorse!42", ipAddress: "1.1.1.1" });
  assert.equal(result.ok, false);
  assert.equal(audit.events.some((e) => e.eventType === "auth.password.reset_failed" && e.systemNote === "Token expired"), true);
});

test("ConfirmPasswordResetHandler rejects already-used token", async () => {
  const audit = fakeAudit();
  const { PasswordResetToken } = await import("@donordesk/domain");
  const used = PasswordResetToken.create({
    id: "tok-used",
    tenantId: TenantId.create("tenant-a"),
    userId: "user-1",
    expiresAt: new Date("2026-09-01T13:00:00Z"),
  }).token;
  used.consume(new Date("2026-09-01T12:30:00Z"));
  const users = { findByIdGlobal: async () => ({ ok: true, value: null }), updatePasswordHash: async () => ({ ok: true, value: null }) };
  const tokens = { findActiveByHash: async () => ({ ok: true, value: used }), markUsed: async () => ({ ok: true, value: used }) };
  const handler = new ConfirmPasswordResetHandler(users, tokens, fakeAuth(), audit, fakeClock(new Date("2026-09-01T12:00:00Z")));
  const result = await handler.handle({ token: "x".repeat(40), newPassword: "CorrectHorse!42", ipAddress: "1.1.1.1" });
  assert.equal(result.ok, false);
  assert.equal(audit.events.some((e) => e.eventType === "auth.password.reset_failed" && e.systemNote === "Token already used"), true);
});

test("ConfirmPasswordResetHandler succeeds: consumes token and updates hash", async () => {
  const audit = fakeAudit();
  const { PasswordResetToken } = await import("@donordesk/domain");
  const clockAt = new Date("2026-09-01T12:00:00Z");
  const { token } = PasswordResetToken.create({
    id: "tok-ok",
    tenantId: TenantId.create("tenant-a"),
    userId: "user-1",
    expiresAt: new Date(clockAt.getTime() + 60 * 60_000),
  });
  let updatedHash = null;
  let usedAt = null;
  const users = {
    findByIdGlobal: async () => ({ ok: true, value: makeUser() }),
    updatePasswordHash: async (id, tid, hash) => { updatedHash = hash; return { ok: true, value: makeUser({ passwordHash: hash, passwordChangedAt: new Date() }) }; },
  };
  const tokens = {
    findActiveByHash: async () => ({ ok: true, value: token }),
    markUsed: async () => { usedAt = new Date(clockAt.getTime() + 1000); return { ok: true, value: token }; },
  };
  const handler = new ConfirmPasswordResetHandler(users, tokens, fakeAuth(), audit, fakeClock(clockAt));
  const result = await handler.handle({ token: token.tokenHash, newPassword: "NewPass!2026Secure", ipAddress: "1.1.1.1" });
  assert.equal(result.ok, true);
  assert.match(updatedHash ?? "", /^hash:NewPass!2026Secure$/);
  assert.notEqual(usedAt, null);
  const types = audit.events.map((e) => e.eventType);
  assert.ok(types.includes("auth.password.reset_completed"));
  assert.ok(types.includes("auth.session.invalidated"));
});
