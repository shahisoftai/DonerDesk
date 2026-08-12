import assert from "node:assert/strict";
import test from "node:test";
import { DateRange, DomainError, EvidenceFile, Permissions, TenantId, EvidenceEmbedding, LlmPrompt, LlmRun } from "../dist/index.js";

test("tenant identifiers reject empty and short values", () => {
  assert.throws(() => TenantId.create("x"), (error) => error instanceof DomainError && error.code === "VALIDATION_FAILED");
  assert.equal(TenantId.create("ngo-a").toString(), "ngo-a");
});

test("AI domain objects reject malformed metrics and cross-tenant vectors", () => {
  assert.throws(() => EvidenceEmbedding.create({
    id: "bad", props: { chunkId: "c", tenantId: "tenant-a", modelId: "m", provider: "local", vector: [1], dimensions: 2 },
  }), DomainError);
  const first = EvidenceEmbedding.create({
    id: "a", props: { chunkId: "c1", tenantId: "tenant-a", modelId: "m", provider: "local", vector: [1, 0], dimensions: 2 },
  });
  const second = EvidenceEmbedding.create({
    id: "b", props: { chunkId: "c2", tenantId: "tenant-b", modelId: "m", provider: "local", vector: [1, 0], dimensions: 2 },
  });
  assert.throws(() => first.cosineSimilarity(second), (error) => error?.code === "FORBIDDEN");
  assert.throws(() => LlmRun.create({
    id: "r", props: { modelId: "m", promptId: "p", tenantId: "tenant-a", inputTokens: 2, outputTokens: 3, totalTokens: 99, costUsd: 0, latencyMs: 1, status: "success", promptVersion: 1, modelVersion: "1" },
  }), DomainError);
});

test("prompt rendering requires all variables and versioning uses a new identity", () => {
  const prompt = LlmPrompt.create({ id: "p1", props: { name: "draft", version: 1, promptText: "Hello {{name}}", variables: ["name"], isActive: true } });
  assert.equal(prompt.render({ name: "World" }), "Hello World");
  assert.throws(() => prompt.render({}), DomainError);
  assert.throws(() => prompt.incrementVersion("p1"), DomainError);
  const next = prompt.incrementVersion("p2");
  assert.equal(next.id, "p2");
  assert.equal(next.version, 2);
});

test("date ranges enforce ordering and retain inclusive boundaries", () => {
  assert.throws(() => DateRange.create(new Date("2025-02-01"), new Date("2025-01-01")), DomainError);
  const range = DateRange.create(new Date("2025-01-01"), new Date("2025-01-03"));
  assert.equal(range.days(), 3);
  assert.equal(range.contains(new Date("2025-01-03")), true);
});

test("role permissions enforce Phase 1 RBAC", () => {
  assert.equal(Permissions.can("FIELD_OFFICER", "evidence.upload"), true);
  assert.equal(Permissions.can("FIELD_OFFICER", "report.approve"), false);
  assert.throws(() => Permissions.require("VIEWER", "project.edit"), (error) => error instanceof DomainError && error.code === "FORBIDDEN");
});

test("evidence defaults to internal and follows verification behavior", () => {
  const evidence = EvidenceFile.create({
    id: "e-1", tenantId: "tenant-a", projectId: "p-1", fileName: "visit.pdf",
    title: "Field visit", fileUrl: "/v1/files/tenant-a%2Fevidence%2Fe-1.pdf",
    fileType: "application/pdf", fileSize: 10, evidenceType: "FIELD_VISIT_REPORT", uploadedById: "u-1",
  });
  assert.equal(evidence.confidentialityLevel, "INTERNAL");
  assert.equal(evidence.verificationStatus, "UPLOADED");
  evidence.verify();
  assert.equal(evidence.verificationStatus, "VERIFIED");
});
