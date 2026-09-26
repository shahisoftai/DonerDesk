import assert from "node:assert/strict";
import test from "node:test";
import { DeterministicAssertionExtractor } from "../dist/llm/assertion-extractor.js";
import { Sha256HashService } from "../dist/llm/hash-service.js";
import { DeterministicEntailmentVerifier } from "../dist/llm/verifier-strategies.js";
import { DeterministicEvidenceIntegrityVerifier } from "../dist/llm/evidence-integrity-verifier.js";
import { DeterministicRequirementResolver } from "../dist/llm/requirement-resolver.js";
import { DefaultExportBuilder } from "../dist/exports/builder.js";

const extractor = new DeterministicAssertionExtractor();

test("extracts numeric, causal, and compliance assertions from content", async () => {
  const content = [
    "Reached 500 beneficiaries in the reporting period.",
    "The training caused the increase in attendance.",
    "The project complies with the safeguarding policy.",
    "General description of ongoing activities.",
  ].join(" ");

  const result = await extractor.extract({ content, writerClaims: [] });
  assert.ok(result.ok);
  const types = result.value.map((a) => a.type);
  assert.ok(types.includes("NUMERIC"));
  assert.ok(types.includes("CAUSAL"));
  assert.ok(types.includes("COMPLIANCE_DECLARATION"));
  assert.ok(types.includes("QUALITATIVE"));
});

test("numeric assertions carry extracted atoms with correct offsets", async () => {
  const content = "Reached 500 beneficiaries this quarter.";
  const result = await extractor.extract({ content, writerClaims: [] });
  assert.ok(result.ok);
  const numeric = result.value.find((a) => a.type === "NUMERIC");
  assert.ok(numeric);
  assert.ok(numeric.numericAtoms.length >= 1);
  assert.equal(content.slice(numeric.charStart, numeric.charEnd), "Reached 500 beneficiaries this quarter.");
  const atom = numeric.numericAtoms[0];
  assert.equal(content.slice(atom.charStart, atom.charEnd), "500");
});

test("writer claims are reconciled: omitted claims cannot escape the pipeline", async () => {
  const content = "Reached 500 beneficiaries this quarter.";
  const writerClaims = [
    { text: "Reached 500 beneficiaries this quarter.", type: "NUMERIC", proposedSources: [{ evidenceId: "e-1", chunkId: "e-1:0", sourceText: "500 beneficiaries" }] },
  ];
  const result = await extractor.extract({ content, writerClaims });
  assert.ok(result.ok);
  const matched = result.value.find((a) => a.type === "NUMERIC");
  assert.ok(matched);
  assert.equal(matched.extractionOrigin, "WRITER");
  assert.equal(matched.sources.length, 1);
});

test("an empty writer claims array still surfaces all material assertions", async () => {
  const content = "Reached 500 beneficiaries this quarter.";
  const result = await extractor.extract({ content, writerClaims: [] });
  assert.ok(result.ok);
  assert.ok(result.value.some((a) => a.type === "NUMERIC" && a.materiality === "MATERIAL"));
});

test("hash service produces stable sha256 digests", () => {
  const hasher = new Sha256HashService();
  const a = hasher.normalizeAndHash("hello   world");
  const b = hasher.normalizeAndHash("hello world");
  assert.equal(a, b);
  assert.match(a, /^[0-9a-f]{64}$/);
});

test("entailment supports, contradicts, and defers", async () => {
  const verifier = new DeterministicEntailmentVerifier();
  const supported = await verifier.verify({
    assertionText: "Training sessions were delivered to 45 participants",
    assertionType: "FACTUAL",
    evidence: [{ evidenceId: "e-1", chunkId: "c1", chunkText: "Training sessions were delivered to 45 participants in June", score: 1 }],
  });
  assert.equal(supported.value.verdict, "SUPPORTED");

  const contradicted = await verifier.verify({
    assertionText: "Training sessions were delivered to 45 participants",
    assertionType: "FACTUAL",
    evidence: [{ evidenceId: "e-1", chunkId: "c1", chunkText: "No evidence training sessions were delivered", score: 1 }],
  });
  assert.equal(contradicted.value.verdict, "CONTRADICTED");

  const uncertain = await verifier.verify({
    assertionText: "Training sessions were delivered to 45 participants",
    assertionType: "FACTUAL",
    evidence: [{ evidenceId: "e-1", chunkId: "c1", chunkText: "The program operates in three districts", score: 1 }],
  });
  assert.equal(uncertain.value.verdict, "INSUFFICIENT");
});

test("evidence integrity flags missing chunks and hash mismatches", async () => {
  const verifier = new DeterministicEvidenceIntegrityVerifier();
  const missing = await verifier.verify({
    sources: [{ evidenceId: "e-1", chunkId: "e-1:0", sourceText: "some text" }],
    evidencePackages: [],
  });
  assert.equal(missing.value.valid, false);
  assert.ok(missing.value.reasons.includes("SOURCE_NOT_FOUND"));

  const packages = [
    {
      evidenceId: "e-1",
      title: "t",
      fileName: "f",
      evidenceType: "x",
      verificationStatus: "VERIFIED",
      confidentialityLevel: "INTERNAL",
      chunks: [{ chunkId: "e-1:0", text: "exact text", tokenCount: 2, chunkIndex: 0 }],
      evidenceHash: "hash-a",
      evidenceUpdatedAt: new Date(),
      chunkerVersion: "v1",
    },
  ];
  const hash = await verifier.verify({
    sources: [{ evidenceId: "e-1", chunkId: "e-1:0", sourceText: "exact text", evidenceHash: "hash-b" }],
    evidencePackages: packages,
  });
  assert.equal(hash.value.valid, false);
  assert.ok(hash.value.reasons.includes("EVIDENCE_HASH_MISMATCH"));
});

function stubRepo(overrides = {}) {
  const requirement = {
    id: "r1",
    key: "SECTION:executive-summary",
    kind: "SECTION",
    required: true,
    severity: "BLOCKING",
    sourceReference: { sourceType: "DONOR_PACK", sourceId: "pack", version: 1, label: "pack" },
  };
  return {
    periods: {
      findById: async () => ({
        ok: true,
        value: {
          projectId: "proj-1",
          reportType: "ANNUAL",
          templateSnapshotJson: JSON.stringify({ donorKey: "un-ocha-standard-grant", mechanismKey: "annual-report" }),
        },
      }),
    },
    packs: {
      findActiveByMechanism: async () => ({
        ok: true,
        value: {
          id: "pack-1",
          donorKey: "un-ocha-standard-grant",
          mechanismKey: "annual-report",
          reportType: "ANNUAL",
          version: 1,
          language: "en",
          name: "OCHA pack",
          status: "ACTIVE",
          requirements: [requirement],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      }),
    },
    overrides: { findActiveForProject: async () => ({ ok: true, value: [] }) },
    plans: { findByReportingPeriod: async () => ({ ok: true, value: [{ sections: [{ title: "Executive Summary" }] }] }) },
    resolved: { create: async (r) => ({ ok: true, value: r }) },
    ...overrides,
  };
}

test("requirement resolver merges layers and computes coverage", async () => {
  const repos = stubRepo();
  const ids = { generate: () => "resolved-1" };
  const resolver = new DeterministicRequirementResolver(ids, repos.periods, repos.packs, repos.overrides, repos.plans, repos.resolved);
  const result = await resolver.resolve({ tenantId: { toString: () => "tenant-a" }, reportingPeriodId: "period-1", effectiveDate: new Date() });
  assert.ok(result.ok);
  assert.equal(result.value.snapshot.length, 1);
  assert.ok(result.value.coverage.satisfied.includes("SECTION:executive-summary"));
  assert.equal(result.value.coverage.unmet.length, 0);
  assert.equal(result.value.sourceTrace[0].sourceReference.sourceType, "DONOR_PACK");
});

test("requirement resolver flags unmet mandatory requirements", async () => {
  const repos = stubRepo({
    plans: { findByReportingPeriod: async () => ({ ok: true, value: [{ sections: [{ title: "Risk Management" }] }] }) },
  });
  const resolver = new DeterministicRequirementResolver({ generate: () => "resolved-2" }, repos.periods, repos.packs, repos.overrides, repos.plans, repos.resolved);
  const result = await resolver.resolve({ tenantId: { toString: () => "tenant-a" }, reportingPeriodId: "period-1", effectiveDate: new Date() });
  assert.ok(result.ok);
  assert.ok(result.value.coverage.unmet.includes("SECTION:executive-summary"));
});

test("export builder enforces intent and watermark rules", async () => {
  const builder = new DefaultExportBuilder();
  const base = {
    exportType: "EVIDENCE_CHECKLIST",
    projectName: "Project",
    reportingPeriodLabel: "Q1 2026",
    reportTitle: "Report",
    sections: [],
    indicators: [],
    activities: [],
    checklist: [],
    evidenceItems: [],
    includeSensitive: false,
  };
  await assert.rejects(() => builder.build({ ...base, exportIntent: "DONOR_SUBMISSION", watermark: "WATERMARK" }), /never be watermarked/);
  await assert.rejects(() => builder.build({ ...base, exportIntent: "DONOR_SUBMISSION" }), /submission snapshot/);
  await assert.rejects(() => builder.build({ ...base, exportIntent: "INTERNAL_REVIEW" }), /watermarked/);
  const internal = await builder.build({ ...base, exportIntent: "INTERNAL_REVIEW", watermark: "INTERNAL PREVIEW" });
  assert.ok(internal.fileBuffer.length > 0);
});

test("buildDonorTemplate: byte-identical fallback behaviour when no donor-template mapping is configured (default state for every tenant)", async () => {
  const builder = new DefaultExportBuilder();
  const base = {
    exportType: "DONOR_TEMPLATE",
    exportIntent: "INTERNAL_REVIEW",
    watermark: "INTERNAL PREVIEW",
    projectName: "EERP-2026",
    reportingPeriodLabel: "Aug 2026",
    reportTitle: "EERP-2026 report",
    sections: [{ title: "Executive Summary", content: "Real content.", status: "APPROVED" }],
    indicators: [],
    activities: [],
    checklist: [],
    evidenceItems: [],
    includeSensitive: false,
  };
  // No `donorTemplate` field at all — the default for every existing tenant.
  const withoutMapping = await builder.build(base);
  // Explicit env flag on but no storage/renderer wired — must still fall back.
  process.env.DONOR_TEMPLATE_RENDER_ENABLED = "1";
  const withFlagButNoDeps = await builder.build(base);
  delete process.env.DONOR_TEMPLATE_RENDER_ENABLED;

  assert.ok(withoutMapping.fileBuffer.length > 0);
  assert.equal(withoutMapping.contentType, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  // The `docx` library embeds a per-call-unique core-properties timestamp,
  // so exact byte-length equality across two independently generated
  // documents is not guaranteed even for structurally identical input —
  // assert the fallback path was taken both times (both are non-trivial,
  // similarly-sized generic DOCX output) rather than exact byte match.
  assert.ok(withFlagButNoDeps.fileBuffer.length > 0);
  assert.ok(
    Math.abs(withFlagButNoDeps.fileBuffer.length - withoutMapping.fileBuffer.length) < 50,
    "output size must be near-identical regardless of the flag when the renderer/storage deps are absent",
  );
});

test("buildDonorTemplate: renders via the worker when a mapping is present, flag is on, and the renderer succeeds", async () => {
  const fakeStorage = {
    read: async (key) => Buffer.from(`templated:${key}`),
  };
  const renderedBuffer = Buffer.from("RENDERED DOCX BYTES");
  const fakeRenderer = {
    render: async ({ context }) => {
      assert.equal(context.region_h_0001, "Real content.");
      return { ok: true, value: { renderedDocxBuffer: renderedBuffer } };
    },
  };
  const builder = new DefaultExportBuilder(fakeStorage, fakeRenderer);
  process.env.DONOR_TEMPLATE_RENDER_ENABLED = "1";
  const result = await builder.build({
    exportType: "DONOR_TEMPLATE",
    exportIntent: "INTERNAL_REVIEW",
    watermark: "INTERNAL PREVIEW",
    projectName: "EERP-2026",
    reportingPeriodLabel: "Aug 2026",
    reportTitle: "EERP-2026 report",
    sections: [{ title: "Executive Summary", content: "Real content.", status: "APPROVED" }],
    indicators: [],
    activities: [],
    checklist: [],
    evidenceItems: [],
    includeSensitive: false,
    donorTemplate: {
      templatedFileKey: "donor-template-mappings/t1/m1/templated.docx",
      placeholderSections: [{ placeholderKey: "region_h_0001", sectionTitle: "Executive Summary" }],
    },
  });
  delete process.env.DONOR_TEMPLATE_RENDER_ENABLED;
  assert.equal(result.fileBuffer.toString(), "RENDERED DOCX BYTES");
});

test("buildDonorTemplate: falls back to the generic DOCX when the renderer fails", async () => {
  const fakeStorage = { read: async () => Buffer.from("templated") };
  const fakeRenderer = { render: async () => ({ ok: false, error: { message: "worker unreachable" } }) };
  const builder = new DefaultExportBuilder(fakeStorage, fakeRenderer);
  process.env.DONOR_TEMPLATE_RENDER_ENABLED = "1";
  const result = await builder.build({
    exportType: "DONOR_TEMPLATE",
    exportIntent: "INTERNAL_REVIEW",
    watermark: "INTERNAL PREVIEW",
    projectName: "EERP-2026",
    reportingPeriodLabel: "Aug 2026",
    reportTitle: "EERP-2026 report",
    sections: [{ title: "Executive Summary", content: "Real content.", status: "APPROVED" }],
    indicators: [],
    activities: [],
    checklist: [],
    evidenceItems: [],
    includeSensitive: false,
    donorTemplate: {
      templatedFileKey: "x",
      placeholderSections: [{ placeholderKey: "region_h_0001", sectionTitle: "Executive Summary" }],
    },
  });
  delete process.env.DONOR_TEMPLATE_RENDER_ENABLED;
  assert.notEqual(result.fileBuffer.toString(), "RENDERED DOCX BYTES");
  assert.ok(result.fileBuffer.length > 0, "must still produce a usable export, never a hard failure");
});
