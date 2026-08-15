import assert from "node:assert/strict";
import test from "node:test";
import { ConnectGoogleDriveHandler, LinkGoogleDriveEvidenceHandler, GoogleSignInHandler, ProvisionTenantHandler } from "../dist/index.js";
import { TenantId } from "@donordesk/domain";

const tenant = { tenantId: TenantId.create("tenant-a"), userId: "u-1", role: "ADMIN" };
const ctx = { tenant, requestId: "r-1" };

function makeOrgs(provider = "LOCAL") {
  const org = {
    id: "org-1",
    storageProvider: provider,
    updateProfile(patch) { if (patch.storageProvider) this.storageProvider = patch.storageProvider; },
  };
  return {
    org,
    repo: {
      findByTenant: async () => ({ ok: true, value: org }),
      update: async (o) => { org.storageProvider = o.storageProvider; return { ok: true, value: o }; },
    },
  };
}

test("connect google drive begin returns an auth url and state", async () => {
  const connector = { buildAuthUrl: async (state) => ({ authUrl: `https://accounts.google.com/o/oauth2/v2/auth?state=${state}` }), exchangeCode: async () => ({ refreshToken: "rt" }), getConfig: async () => null };
  const { repo } = makeOrgs();
  const handler = new ConnectGoogleDriveHandler(connector, repo, async () => ({ ok: true, value: undefined }), { record: async () => ({ ok: true, value: undefined }) });
  const result = await handler.begin(ctx);
  assert.equal(result.ok, true);
  assert.ok(result.value.authUrl.startsWith("https://accounts.google.com"));
  assert.ok(result.value.state.length > 0);
});

test("connect google drive complete saves token, switches provider, and audits", async () => {
  const connector = { buildAuthUrl: async () => ({ authUrl: "" }), exchangeCode: async () => ({ refreshToken: "rt-1", email: "ng@example.org" }), getConfig: async () => null };
  const { org, repo } = makeOrgs("LOCAL");
  let savedToken = null;
  const auditEvents = [];
  const handler = new ConnectGoogleDriveHandler(
    connector, repo,
    async (_t, token) => { savedToken = token; return { ok: true, value: undefined }; },
    { record: async (e) => { auditEvents.push(e); return { ok: true, value: undefined }; } },
  );
  const result = await handler.complete(ctx, "code-123");
  assert.equal(result.ok, true);
  assert.equal(savedToken, "rt-1");
  assert.equal(org.storageProvider, "GOOGLE_DRIVE");
  assert.equal(auditEvents[0].eventType, "storage.google_drive.connected");
});

test("connect google drive complete rejects a missing refresh token", async () => {
  const connector = { buildAuthUrl: async () => ({ authUrl: "" }), exchangeCode: async () => ({}), getConfig: async () => null };
  const { repo } = makeOrgs();
  const handler = new ConnectGoogleDriveHandler(connector, repo, async () => ({ ok: true, value: undefined }), { record: async () => ({ ok: true, value: undefined }) });
  const result = await handler.complete(ctx, "code");
  assert.equal(result.ok, false);
});

test("link google drive evidence records a drive reference when provider is GOOGLE_DRIVE", async () => {
  const resolver = {
    resolve: async () => ({
      provider: "GOOGLE_DRIVE",
      save: async () => ({ ok: true, value: { provider: "GOOGLE_DRIVE", fileUrl: "https://drive.google.com/file/d/abc/view", fileSize: 0, driveFileId: "abc", driveWebLink: "https://drive.google.com/file/d/abc/view" } }),
      remove: async () => {},
    }),
  };
  const created = [];
  const repo = { create: async (e) => { created.push(e); return { ok: true, value: e }; } };
  const ids = { generate: (() => { let n = 0; return () => `id-${++n}`; })() };
  const handler = new LinkGoogleDriveEvidenceHandler(ids, repo, resolver, { publish: async () => {} }, { record: async () => ({ ok: true, value: undefined }) });
  const result = await handler.handle(ctx, {
    projectId: "p-1", title: "Photo", fileName: "photo.jpg", fileType: "image/jpeg",
    driveFileId: "abc", evidenceType: "PHOTO", confidentialityLevel: "INTERNAL",
  });
  assert.equal(result.ok, true);
  assert.equal(created[0].storageProvider, "GOOGLE_DRIVE");
  assert.equal(created[0].driveFileId, "abc");
  assert.equal(result.value.fileUrl.includes("abc"), true);
});

test("link google drive evidence rejects when tenant storage is not GOOGLE_DRIVE", async () => {
  const resolver = {
    resolve: async () => ({
      provider: "LOCAL",
      save: async () => ({ ok: true, value: { provider: "LOCAL", fileUrl: "/v1/files/x", fileSize: 0 } }),
      remove: async () => {},
    }),
  };
  const repo = { create: async (e) => ({ ok: true, value: e }) };
  const ids = { generate: () => "id-1" };
  const handler = new LinkGoogleDriveEvidenceHandler(ids, repo, resolver, { publish: async () => {} }, { record: async () => ({ ok: true, value: undefined }) });
  const result = await handler.handle(ctx, {
    projectId: "p-1", title: "Photo", fileName: "photo.jpg", fileType: "image/jpeg",
    driveFileId: "abc", evidenceType: "PHOTO",
  });
  assert.equal(result.ok, false);
});

function makeUsers(overrides = {}) {
  const user = {
    id: { toString: () => "u-1" },
    tenantId: tenant.tenantId,
    role: "ADMIN",
    name: "Ada",
    email: { toString: () => "ada@example.org" },
    status: "ACTIVE",
    recordLogin() {},
    ...overrides,
  };
  return user;
}

const signAuth = { hashPassword: async () => "h", verifyPassword: async () => false, sign: async (p) => `token.${p.sub}.${p.tid}`, verify: async () => null };
const sequenceIds = (() => { let n = 0; return { generate: () => `id-${++n}` }; })();

/**
 * Builds a real ProvisionTenantHandler wired to the test's fake org/user
 * repositories so the Google provisioning path is exercised end to end.
 */
function makeProvisioner({ orgs, users, auditEvents }) {
  const grants = { create: async (g) => ({ ok: true, value: g }) };
  const trials = {
    existsByEmailFingerprint: async () => ({ ok: true, value: false }),
    create: async () => ({ ok: true, value: { id: "trial-1" } }),
  };
  const events = { publish: async () => ({ ok: true }) };
  const clock = { now: () => new Date("2026-01-15T00:00:00Z") };
  return new ProvisionTenantHandler(
    sequenceIds,
    orgs,
    users,
    grants,
    trials,
    signAuth,
    events,
    { record: async (e) => { auditEvents.push(e); return { ok: true, value: undefined }; } },
    clock,
  );
}

test("google sign-in exchanges code, finds user by email, and signs a session token", async () => {
  const google = { exchangeCode: async () => ({ email: "ada@example.org", name: "Ada", googleSubject: "g-1" }) };
  const user = makeUsers();
  const users = {
    findByEmailGlobal: async (email) => ({ ok: true, value: email === "ada@example.org" ? user : null }),
    update: async (u) => { assert.ok(u); return { ok: true, value: u }; },
  };
  const auditEvents = [];
  const provisioner = makeProvisioner({ orgs: {}, users: {}, auditEvents });
  const handler = new GoogleSignInHandler(google, users, {}, signAuth, sequenceIds, { record: async (e) => { auditEvents.push(e); return { ok: true, value: undefined }; } }, provisioner);
  const result = await handler.handle({ code: "code-1" });
  assert.equal(result.ok, true);
  assert.equal(result.value.token, "token.u-1.tenant-a");
  assert.equal(result.value.email, "ada@example.org");
  assert.equal(result.value.provisioned, false);
  assert.equal(auditEvents[0].eventType, "identity.user.login");
  assert.equal(auditEvents[0].newValue, "google");
});

test("google sign-in auto-provisions an organization and user for a new email", async () => {
  const google = { exchangeCode: async () => ({ email: "newuser@gmail.com", name: "New User", googleSubject: "g-2" }) };
  const createdOrgs = [];
  const createdUsers = [];
  const orgs = {
    create: async (org) => { createdOrgs.push(org); return { ok: true, value: org }; },
  };
  const users = {
    findByEmailGlobal: async () => ({ ok: true, value: null }),
    create: async (u) => { createdUsers.push(u); return { ok: true, value: u }; },
    update: async (u) => ({ ok: true, value: u }),
  };
  const auditEvents = [];
  const provisioner = makeProvisioner({ orgs, users, auditEvents });
  const handler = new GoogleSignInHandler(google, users, orgs, signAuth, sequenceIds, { record: async (e) => { auditEvents.push(e); return { ok: true, value: undefined }; } }, provisioner);
  const result = await handler.handle({ code: "code-2" });
  assert.equal(result.ok, true);
  assert.equal(result.value.provisioned, true);
  assert.equal(result.value.role, "ADMIN");
  assert.equal(result.value.email, "newuser@gmail.com");
  assert.equal(createdOrgs.length, 1);
  assert.equal(createdOrgs[0].name, "New User's Organization");
  assert.equal(createdOrgs[0].storageProvider, "LOCAL");
  assert.equal(createdUsers.length, 1);
  assert.equal(createdUsers[0].role, "ADMIN");
  assert.equal(createdUsers[0].status, "ACTIVE");
  const types = auditEvents.map((e) => e.eventType);
  assert.ok(types.includes("identity.organization.created"));
  assert.ok(types.includes("identity.user.created"));
  assert.ok(types.includes("identity.user.login"));
});

test("google sign-in rejects when google verification fails", async () => {
  const google = { exchangeCode: async () => { throw new Error("Google ID token verification failed"); } };
  const auditEvents = [];
  const provisioner = makeProvisioner({ orgs: {}, users: {}, auditEvents });
  const handler = new GoogleSignInHandler(google, { findByEmailGlobal: async () => ({ ok: true, value: null }) }, {}, signAuth, sequenceIds, { record: async () => ({ ok: true, value: undefined }) }, provisioner);
  const result = await handler.handle({ code: "bad" });
  assert.equal(result.ok, false);
});
