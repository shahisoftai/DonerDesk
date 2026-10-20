import assert from "node:assert/strict";
import test from "node:test";
import { IssueScimCredentialHandler, ListScimCredentialsHandler, RevokeScimCredentialHandler } from "../dist/index.js";
import { ScimCredential, TenantId, hashScimToken } from "@donordesk/domain";

/**
 * A SCIM credential is a bearer token an identity provider holds. The token is
 * shown once and only its hash is kept, so a leaked database cannot be used to
 * provision users.
 */
const tenantId = TenantId.create("tenant-a");
const ctx = { tenant: { tenantId, userId: "admin-1" }, requestId: "r" };
const ok = (value) => ({ ok: true, value });

function build() {
  const rows = new Map();
  const audits = [];
  const repository = {
    create: async (credential) => {
      rows.set(credential.id, credential);
      return ok(credential);
    },
    update: async (credential) => {
      rows.set(credential.id, credential);
      return ok(credential);
    },
    findByTokenHash: async (tokenHash) => {
      const found = [...rows.values()].find((c) => c.tokenHash === tokenHash);
      return ok(found ?? null);
    },
    findById: async (id, tenant) => {
      const found = rows.get(id);
      return ok(found && found.tenantId.toString() === tenant.toString() ? found : null);
    },
    listByTenant: async (tenant) => {
      return ok([...rows.values()].filter((c) => c.tenantId.toString() === tenant.toString()));
    },
  };
  const ids = { generate: () => "cred-1" };
  const audit = { record: async (e) => { audits.push(e); } };
  return {
    rows,
    audits,
    issue: new IssueScimCredentialHandler(repository, ids, audit),
    list: new ListScimCredentialsHandler(repository),
    revoke: new RevokeScimCredentialHandler(repository, audit),
  };
}

test("issuing a credential returns the token once and stores only its hash", async () => {
  const w = build();
  const result = await w.issue.handle(ctx, { name: "Okta" });
  assert.equal(result.ok, true);
  assert.equal(result.value.name, "Okta");
  assert.ok(result.value.token.length >= 32, "the token is long enough to be unguessable");

  const stored = [...w.rows.values()][0];
  assert.notEqual(stored.tokenHash, result.value.token);
  assert.equal(stored.tokenHash, hashScimToken(result.value.token));
  assert.ok(w.audits.some((a) => a.eventType === "scim.credential.issued"));
});

test("the token is never returned again", async () => {
  const w = build();
  const issued = await w.issue.handle(ctx, { name: "Okta" });
  const listed = await w.list.handle(ctx);
  assert.equal(listed.ok, true);
  assert.equal(listed.value.length, 1);
  assert.equal(listed.value[0].id, issued.value.id);
  assert.equal("token" in listed.value[0], false, "the token is not in the list");
  assert.equal("tokenHash" in listed.value[0], false, "the hash is not in the list either");
});

test("revoking a credential stops it working, and the row stays as the record", async () => {
  const w = build();
  const issued = await w.issue.handle(ctx, { name: "Okta" });
  const found = await w.rows.get(issued.value.id);
  assert.equal(found.isUsable(), true);

  const revoked = await w.revoke.handle(ctx, issued.value.id);
  assert.equal(revoked.ok, true);
  assert.equal(w.rows.get(issued.value.id).isUsable(), false);
  assert.equal(w.rows.get(issued.value.id).isRevoked(), true);
  assert.ok(w.audits.some((a) => a.eventType === "scim.credential.revoked"));

  const listed = await w.list.handle(ctx);
  assert.equal(listed.value.length, 1, "the record of a revoked credential is kept");
  assert.ok(listed.value[0].revokedAt !== null);
});

test("revoking twice is harmless", async () => {
  const w = build();
  const issued = await w.issue.handle(ctx, { name: "Okta" });
  await w.revoke.handle(ctx, issued.value.id);
  const again = await w.revoke.handle(ctx, issued.value.id);
  assert.equal(again.ok, true);
});

test("revoking a credential that is not ours is refused", async () => {
  const w = build();
  const other = { tenant: { tenantId: TenantId.create("tenant-b"), userId: "admin-2" }, requestId: "r" };
  const issued = await w.issue.handle(ctx, { name: "Okta" });
  const result = await w.revoke.handle(other, issued.value.id);
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "NOT_FOUND");
});

test("a credential with no name is refused", async () => {
  const w = build();
  const result = await w.issue.handle(ctx, { name: "x" });
  assert.equal(result.ok, false);
});

test("two credentials have different tokens", () => {
  const a = ScimCredential.create({ id: "a", tenantId, name: "Okta", createdById: "admin-1" });
  const b = ScimCredential.create({ id: "b", tenantId, name: "Entra", createdById: "admin-1" });
  assert.notEqual(a.plaintextToken, b.plaintextToken);
  assert.notEqual(a.credential.tokenHash, b.credential.tokenHash);
});
