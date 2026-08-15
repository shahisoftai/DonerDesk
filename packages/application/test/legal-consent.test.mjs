import assert from "node:assert/strict";
import test from "node:test";
import { TenantId } from "@donordesk/domain";
import { RecordLegalConsentHandler, GetLegalConsentHandler, CONSENT_EVENT_TYPE, LEGAL_DOCUMENT_VERSIONS } from "../dist/index.js";

const ctx = {
  tenant: { tenantId: TenantId.create("tenant-a"), userId: "user-1", role: "ADMIN" },
  requestId: "r-1",
  ipAddress: "127.0.0.1",
};

function ctxWithRole(role) {
  return { tenant: { tenantId: TenantId.create("tenant-a"), userId: "user-1", role }, requestId: "r-1", ipAddress: "127.0.0.1" };
}

test("record-legal-consent rejects without explicit acceptance", async () => {
  const audit = { record: async () => { throw new Error("must not record"); } };
  const handler = new RecordLegalConsentHandler(audit);
  const result = await handler.handle(ctx, { accepted: false });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "VALIDATION_FAILED");
});

test("record-legal-consent writes a chained audit event with document versions", async () => {
  let recorded;
  const audit = { record: async (input) => { recorded = input; } };
  const handler = new RecordLegalConsentHandler(audit);
  const result = await handler.handle(ctx, { accepted: true, source: "onboarding" });
  assert.equal(result.ok, true);
  assert.equal(result.value.accepted, true);
  assert.equal(result.value.termsVersion, LEGAL_DOCUMENT_VERSIONS.terms);
  assert.equal(result.value.privacyVersion, LEGAL_DOCUMENT_VERSIONS.privacy);

  assert.equal(recorded.eventType, CONSENT_EVENT_TYPE);
  assert.equal(recorded.entityType, "organization");
  assert.equal(recorded.actorId, "user-1");
  assert.equal(recorded.ipAddress, "127.0.0.1");
  const stored = JSON.parse(recorded.newValue);
  assert.equal(stored.termsVersion, LEGAL_DOCUMENT_VERSIONS.terms);
  assert.equal(stored.privacyVersion, LEGAL_DOCUMENT_VERSIONS.privacy);
  assert.equal(stored.source, "onboarding");
  assert.ok(stored.acceptedAt);
});

test("get-legal-consent reports not-accepted when no consent event exists", async () => {
  const repo = { listByTenant: async () => ({ ok: true, value: [] }) };
  const handler = new GetLegalConsentHandler(repo);
  const result = await handler.handle(ctxWithRole("VIEWER"));
  assert.equal(result.ok, true);
  assert.equal(result.value.accepted, false);
  assert.equal(result.value.termsVersion, LEGAL_DOCUMENT_VERSIONS.terms);
});

test("get-legal-consent returns the stored consent for the actor", async () => {
  const stored = {
    accepted: true,
    termsVersion: "2026-08-14",
    privacyVersion: "2026-08-14",
    acceptedAt: "2026-08-14T12:00:00.000Z",
    actorId: "user-1",
    source: "onboarding",
  };
  const repo = {
    listByTenant: async () => ({
      ok: true,
      value: [
        {
          id: "audit-1",
          actorId: "user-1",
          eventType: CONSENT_EVENT_TYPE,
          entityType: "organization",
          entityId: "tenant-a",
          newValue: JSON.stringify(stored),
          createdAt: new Date(),
        },
      ],
    }),
  };
  const handler = new GetLegalConsentHandler(repo);
  const result = await handler.handle(ctxWithRole("VIEWER"));
  assert.equal(result.ok, true);
  assert.equal(result.value.accepted, true);
  assert.equal(result.value.termsVersion, "2026-08-14");
  assert.equal(result.value.acceptedAt, "2026-08-14T12:00:00.000Z");
});
