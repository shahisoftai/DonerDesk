import assert from "node:assert/strict";
import test from "node:test";
import { GetEvidenceHandler, SearchEvidenceHandler } from "../dist/index.js";
import { EvidenceFile, TenantId } from "@donordesk/domain";

const tenant = TenantId.create("tenant-a");

function evidence(props) {
  return EvidenceFile.rehydrate({
    id: props.id ?? "e-1",
    tenantId: "tenant-a",
    projectId: "p-1",
    createdAt: new Date("2026-10-01T00:00:00Z"),
    props: {
      fileName: "register.pdf",
      title: "Register",
      fileUrl: "/v1/files/tenant-a/evidence/e-1.pdf",
      fileType: "pdf",
      fileSize: 10,
      storageProvider: "LOCAL",
      storageKey: "tenant-a/evidence/e-1.pdf",
      evidenceType: "DOCUMENT",
      uploadedById: "u-other",
      verificationStatus: "VERIFIED",
      confidentialityLevel: "INTERNAL",
      aiSuggestedTags: [],
      ...props,
    },
  });
}

function context(role, userId = "u-caller") {
  return { tenant: { tenantId: tenant, userId, role }, requestId: "r-1" };
}

function repoWith(files) {
  return {
    findById: async (id) => ({ ok: true, value: files.find((f) => f.id === id) ?? null }),
    findByStorageKey: async (key) => ({ ok: true, value: files.find((f) => f.storageKey === key) ?? null }),
    search: async (filter) => {
      const allowed = filter.allowedConfidentialityLevels;
      const items = files.filter((f) => !allowed || allowed.includes(f.confidentialityLevel));
      return { ok: true, value: { items, total: items.length, page: 1, pageSize: 20 } };
    },
  };
}

test("a viewer cannot open restricted evidence", async () => {
  const files = [evidence({ id: "e-sensitive", confidentialityLevel: "SENSITIVE" })];
  const handler = new GetEvidenceHandler(repoWith(files));
  const result = await handler.handle(context("VIEWER"), "e-sensitive");
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "FORBIDDEN");
});

test("a viewer can open ordinary evidence", async () => {
  const files = [evidence({ id: "e-internal", confidentialityLevel: "INTERNAL" })];
  const handler = new GetEvidenceHandler(repoWith(files));
  const result = await handler.handle(context("VIEWER"), "e-internal");
  assert.equal(result.ok, true);
});

test("a compliance officer can open highly sensitive evidence", async () => {
  const files = [evidence({ id: "e-high", confidentialityLevel: "HIGHLY_SENSITIVE" })];
  const handler = new GetEvidenceHandler(repoWith(files));
  const result = await handler.handle(context("COMPLIANCE_OFFICER"), "e-high");
  assert.equal(result.ok, true);
});

test("the person who uploaded a file can open it whatever its level", async () => {
  const files = [evidence({ id: "e-mine", confidentialityLevel: "HIGHLY_SENSITIVE", uploadedById: "u-caller" })];
  const handler = new GetEvidenceHandler(repoWith(files));
  const result = await handler.handle(context("VIEWER", "u-caller"), "e-mine");
  assert.equal(result.ok, true);
});

test("the list leaves out evidence the caller may not open", async () => {
  const files = [
    evidence({ id: "e-1", confidentialityLevel: "INTERNAL" }),
    evidence({ id: "e-2", confidentialityLevel: "SENSITIVE" }),
    evidence({ id: "e-3", confidentialityLevel: "HIGHLY_SENSITIVE" }),
  ];
  const handler = new SearchEvidenceHandler(repoWith(files));
  const result = await handler.handle(context("VIEWER"), {});
  assert.equal(result.ok, true);
  assert.deepEqual(result.value.items.map((i) => i.id), ["e-1"]);

  const field = await handler.handle(context("FIELD_OFFICER"), {});
  assert.deepEqual(field.value.items.map((i) => i.id), ["e-1", "e-2"]);

  const compliance = await handler.handle(context("COMPLIANCE_OFFICER"), {});
  assert.deepEqual(compliance.value.items.map((i) => i.id), ["e-1", "e-2", "e-3"]);
});
