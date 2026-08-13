import assert from "node:assert/strict";
import test from "node:test";
import { PersistEvidenceTagsHandler } from "../dist/index.js";
import { EvidenceFile, TenantId } from "@donordesk/domain";

const ctx = { tenant: { tenantId: TenantId.create("tenant-a"), userId: "user-1", role: "ADMIN" }, requestId: "r-1" };

function makeEvidence() {
  return EvidenceFile.create({
    id: "ev-1",
    tenantId: "tenant-a",
    projectId: "proj-1",
    fileName: "report.pdf",
    title: "Report",
    fileUrl: "/v1/files/tenant-a/evidence/ev-1.pdf",
    fileType: "application/pdf",
    fileSize: 10,
    evidenceType: "FIELD_VISIT_REPORT",
    uploadedById: "user-1",
  });
}

test("persist-evidence-tags handler persists supplied tags and audits", async () => {
  const ev = makeEvidence();
  let updated = false;
  const repo = {
    findById: async () => ({ ok: true, value: ev }),
    update: async (e) => {
      updated = true;
      return { ok: true, value: e };
    },
  };
  const auditCalls = [];
  const audit = { record: async (input) => { auditCalls.push(input); return { ok: true, value: undefined }; } };
  const handler = new PersistEvidenceTagsHandler(repo, audit);

  const result = await handler.handle(ctx, "ev-1", {
    summary: "Suggested classification.",
    tags: [{ field: "evidenceType", value: "PHOTO", confidence: "HIGH", accepted: false }],
    model: "stub-v1",
  });

  assert.equal(result.ok, true);
  assert.equal(updated, true);
  assert.equal(ev.verificationStatus, "AI_TAGGED");
  assert.equal(ev.aiSuggestedTags.length, 1);
  assert.equal(auditCalls.length, 1);
  assert.equal(auditCalls[0].eventType, "evidence.tags_persisted");
  assert.equal(auditCalls[0].entityId, "ev-1");
});

test("persist-evidence-tags handler returns not-found for unknown evidence", async () => {
  const repo = {
    findById: async () => ({ ok: true, value: null }),
    update: async () => ({ ok: true, value: null }),
  };
  const handler = new PersistEvidenceTagsHandler(repo, { record: async () => ({ ok: true, value: undefined }) });
  const result = await handler.handle(ctx, "nope", { summary: "", tags: [] });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "NOT_FOUND");
});

test("persist-evidence-tags handler acquires a fresh idempotency key and persists", async () => {
  const ev = makeEvidence();
  let updated = false;
  const repo = {
    findById: async () => ({ ok: true, value: ev }),
    update: async (e) => {
      updated = true;
      return { ok: true, value: e };
    },
  };
  let acquired;
  const idempotency = { acquire: async (input) => { acquired = input; return { ok: true, value: { acquired: true } }; } };
  const handler = new PersistEvidenceTagsHandler(repo, { record: async () => ({ ok: true, value: undefined }) }, idempotency);

  const result = await handler.handle(ctx, "ev-1", { summary: "s", tags: [], idempotencyKey: "key-1" });
  assert.equal(result.ok, true);
  assert.equal(updated, true);
  assert.equal(acquired.key, "key-1");
  assert.equal(acquired.jobName, "evidence.persist_tags");
  assert.equal(acquired.entityId, "ev-1");
});

test("persist-evidence-tags handler skips on a duplicate idempotency key", async () => {
  const ev = makeEvidence();
  let updated = false;
  const repo = {
    findById: async () => ({ ok: true, value: ev }),
    update: async (e) => {
      updated = true;
      return { ok: true, value: e };
    },
  };
  const idempotency = { acquire: async () => ({ ok: true, value: { acquired: false } }) };
  const handler = new PersistEvidenceTagsHandler(repo, { record: async () => ({ ok: true, value: undefined }) }, idempotency);

  const result = await handler.handle(ctx, "ev-1", { summary: "s", tags: [], idempotencyKey: "dup-key" });
  assert.equal(result.ok, true);
  assert.equal(updated, false);
});
