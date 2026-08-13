import assert from "node:assert/strict";
import test from "node:test";
import {
  InternalEvidenceResponseSchema,
  PersistTagsBodySchema,
  JobEnvelopeSchema,
  JOB_NAMES,
  JobNameSchema,
} from "../dist/index.js";

test("internal evidence response schema validates a full payload", () => {
  const parsed = InternalEvidenceResponseSchema.parse({
    id: "ev-1",
    projectId: "proj-1",
    fileName: "report.pdf",
    title: "Field report",
    fileUrl: "/v1/files/tenant-a/evidence/ev-1.pdf",
    storageKey: "tenant-a/evidence/ev-1.pdf",
    fileType: "application/pdf",
    fileSize: 1024,
    evidenceType: "FIELD_VISIT_REPORT",
    uploadedById: "user-1",
    verificationStatus: "UPLOADED",
    confidentialityLevel: "INTERNAL",
  });
  assert.equal(parsed.id, "ev-1");
  assert.deepEqual(parsed.aiSuggestedTags, []);
});

test("internal evidence response rejects missing required fields", () => {
  assert.equal(InternalEvidenceResponseSchema.safeParse({ id: "ev-1" }).success, false);
});

test("persist tags body validates and defaults", () => {
  const parsed = PersistTagsBodySchema.parse({
    tags: [{ field: "evidenceType", value: "PHOTO", confidence: "HIGH", accepted: false }],
    idempotencyKey: "kt-123",
  });
  assert.equal(parsed.summary, "");
  assert.equal(parsed.tags[0].value, "PHOTO");
  assert.equal(parsed.tags[0].accepted, false);
  assert.equal(parsed.idempotencyKey, "kt-123");
});

test("persist tags body rejects invalid tag fields", () => {
  assert.equal(PersistTagsBodySchema.safeParse({ tags: [{ field: "nope", value: "x", confidence: "HIGH" }] }).success, false);
});

test("job envelope validates a payload", () => {
  const parsed = JobEnvelopeSchema.parse({ jobName: "evidence.suggest_tags", payload: { evidenceId: "ev-1" } });
  assert.equal(parsed.jobName, "evidence.suggest_tags");
  assert.equal(parsed.payload.evidenceId, "ev-1");
});

test("job names enum is exhaustive and validated", () => {
  assert.equal(JOB_NAMES.length, 8);
  for (const name of JOB_NAMES) assert.equal(JobNameSchema.safeParse(name).success, true);
  assert.equal(JobNameSchema.safeParse("not-a-job").success, false);
  assert.equal(JobEnvelopeSchema.safeParse({ jobName: "unknown.job", payload: {} }).success, false);
});
