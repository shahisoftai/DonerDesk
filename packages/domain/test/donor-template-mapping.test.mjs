import assert from "node:assert/strict";
import test from "node:test";
import { DonorTemplateMapping } from "../dist/index.js";

test("create rejects an incomplete region", () => {
  assert.throws(() => DonorTemplateMapping.create({
    id: "m-1", tenantId: "t-1", templateId: "tpl-1",
    regions: [{ regionId: "h-1", templateSectionId: "", placeholderKey: "x", mappedBy: "AUTO", status: "DRAFT" }],
  }));
});

test("approve rejects a mapping with zero mapped regions", () => {
  const mapping = DonorTemplateMapping.create({ id: "m-1", tenantId: "t-1", templateId: "tpl-1", regions: [] });
  assert.throws(() => mapping.approve("user-1"), /no reviewed regions/);
});

test("approve rejects a mapping with an unreviewed (AUTO/DRAFT) region", () => {
  const mapping = DonorTemplateMapping.create({
    id: "m-1", tenantId: "t-1", templateId: "tpl-1",
    regions: [{ regionId: "h-1", templateSectionId: "s-1", placeholderKey: "exec_summary", mappedBy: "AUTO", status: "DRAFT" }],
  });
  assert.throws(() => mapping.approve("user-1"), /not been reviewed/);
});

test("reviewedBy marks a region MANUAL+REVIEWED, and approve then succeeds", () => {
  const mapping = DonorTemplateMapping.create({
    id: "m-1", tenantId: "t-1", templateId: "tpl-1",
    regions: [{ regionId: "h-1", templateSectionId: "s-1", placeholderKey: "exec_summary", mappedBy: "AUTO", status: "DRAFT" }],
  });
  const reviewed = mapping.reviewedBy("h-1", "s-1", "exec_summary");
  assert.equal(reviewed.regionsList[0].status, "REVIEWED");
  assert.equal(reviewed.regionsList[0].mappedBy, "MANUAL");

  const approved = reviewed.approve("user-1");
  assert.ok(approved.approvedAt);
  assert.equal(approved.approvedById, "user-1");
  assert.equal(approved.regionsList[0].status, "APPROVED");
});

test("reviewedBy adds a new region when the regionId was previously unmapped", () => {
  const mapping = DonorTemplateMapping.create({ id: "m-1", tenantId: "t-1", templateId: "tpl-1", regions: [] });
  const updated = mapping.reviewedBy("h-99", "s-1", "some_section");
  assert.equal(updated.regionsList.length, 1);
  assert.equal(updated.regionsList[0].regionId, "h-99");
});

test("approve is idempotent (calling it twice does not change approvedAt)", () => {
  const mapping = DonorTemplateMapping.create({
    id: "m-1", tenantId: "t-1", templateId: "tpl-1",
    regions: [{ regionId: "h-1", templateSectionId: "s-1", placeholderKey: "exec_summary", mappedBy: "MANUAL", status: "REVIEWED" }],
  });
  const first = mapping.approve("user-1");
  const second = first.approve("user-2");
  assert.equal(second.approvedById, "user-1");
  assert.equal(second.approvedAt.getTime(), first.approvedAt.getTime());
});

test("reviewedBy throws once the mapping is approved — must create a new version instead", () => {
  const mapping = DonorTemplateMapping.create({
    id: "m-1", tenantId: "t-1", templateId: "tpl-1",
    regions: [{ regionId: "h-1", templateSectionId: "s-1", placeholderKey: "exec_summary", mappedBy: "MANUAL", status: "REVIEWED" }],
  }).approve("user-1");
  assert.throws(() => mapping.reviewedBy("h-1", "s-2", "other"), /create a new version/);
});

test("withTemplatedFile attaches the rendered-placeholder DOCX url without touching regions", () => {
  const mapping = DonorTemplateMapping.create({ id: "m-1", tenantId: "t-1", templateId: "tpl-1", regions: [] });
  const withFile = mapping.withTemplatedFile("storage://templated/m-1.docx");
  assert.equal(withFile.templatedFileUrl, "storage://templated/m-1.docx");
  assert.equal(withFile.regionsList.length, 0);
});

test("rehydrate round-trips detectedRegions and templatedFileUrl", () => {
  const mapping = DonorTemplateMapping.rehydrate({
    id: "m-1", tenantId: "t-1", templateId: "tpl-1", version: 2,
    regions: [], approvedById: undefined, approvedAt: undefined, createdAt: new Date(),
    detectedRegions: [{ id: "h-1", kind: "HEADING", text: "x", order: 0 }],
    templatedFileUrl: "storage://x.docx",
  });
  assert.equal(mapping.detectedRegions.length, 1);
  assert.equal(mapping.templatedFileUrl, "storage://x.docx");
});
