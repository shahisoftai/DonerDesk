import assert from "node:assert/strict";
import test from "node:test";
import { ResolveSectionFlagsHandler } from "../dist/index.js";
import { TenantId, ReportClaim } from "@donordesk/domain";

const ctx = (role = "ADMIN") => ({ tenant: { tenantId: TenantId.create("tenant-t"), userId: "u", role }, requestId: "r" });
const claim = (id, over) => ReportClaim.create({ id, tenantId: "tenant-t", projectId: "p", reportDraftId: "d", sectionId: "s-1", text: `Statement ${id}`, type: "QUALITATIVE", ...over });

function setup(claims) {
  const calls = { resolved: [], approved: 0, audit: [] };
  const claimsRepo = { async findBySection() { return { ok: true, value: claims }; } };
  const resolveClaim = {
    async handle(_c, id, input) {
      calls.resolved.push([id, input]);
      claims.find((c) => c.id === id).resolve({ result: input.resolution, notes: input.notes, by: "u" });
      return { ok: true, value: { claimId: id } };
    },
  };
  const approveSection = { async handle() { calls.approved += 1; return { ok: true, value: undefined }; } };
  const sections = { async findById() { return { ok: true, value: { id: "s-1" } }; } };
  const audit = { async record(e) { calls.audit.push(e); } };
  return { calls, h: new ResolveSectionFlagsHandler(sections, claimsRepo, resolveClaim, approveSection, audit) };
}

const NOTE = "Interpretive statements reviewed by the programme lead.";

test("accepts only UNCONFIRMED statements with the one note, then approves", async () => {
  const claims = [
    claim("c1", { verificationReasonCode: "ENTAILMENT_UNCERTAIN" }),
    claim("c2", { verificationReasonCode: "COVERAGE_GAP", materiality: "NOT_MATERIAL" }),
  ];
  const { h, calls } = setup(claims);
  const r = await h.handle(ctx(), { sectionId: "s-1", note: NOTE, approve: true });
  assert.equal(r.ok, true);
  assert.equal(r.value.resolved, 2);
  assert.equal(r.value.approved, true);
  assert.deepEqual(calls.resolved.map(([, i]) => [i.resolution, i.notes]), [["ACCEPTED_WITH_LIMITATION", NOTE], ["ACCEPTED_WITH_LIMITATION", NOTE]]);
  assert.equal(calls.audit.length, 1);
  assert.equal(calls.audit[0].eventType, "report.section.flags_resolved");
});

test("a figure error is never touched and blocks approval", async () => {
  const claims = [
    claim("c1", { verificationReasonCode: "ENTAILMENT_UNCERTAIN" }),
    claim("c2", { type: "NUMERIC", verificationReasonCode: "VALUE_MISMATCH" }),
  ];
  const { h, calls } = setup(claims);
  const r = await h.handle(ctx(), { sectionId: "s-1", note: NOTE, approve: true });
  assert.equal(r.value.resolved, 1);
  assert.equal(r.value.approved, false);
  assert.deepEqual(r.value.remaining.map((x) => [x.claimId, x.flagClass]), [["c2", "REPORT_ERROR"]]);
  assert.equal(calls.approved, 0);
  assert.equal(calls.resolved.some(([id]) => id === "c2"), false);
});

test("an integrity decision (confidentiality) is left for a person", async () => {
  const { h } = setup([claim("c1", { verificationReasonCode: "CONFIDENTIALITY_RESTRICTED" })]);
  const r = await h.handle(ctx(), { sectionId: "s-1", note: NOTE });
  assert.equal(r.value.resolved, 0);
  assert.equal(r.value.remaining[0].flagClass, "NEEDS_DECISION");
});

test("a note shorter than 10 characters is refused and nothing changes", async () => {
  const { h, calls } = setup([claim("c1", { verificationReasonCode: "ENTAILMENT_UNCERTAIN" })]);
  const r = await h.handle(ctx(), { sectionId: "s-1", note: "ok" });
  assert.equal(r.ok, false);
  assert.equal(r.error.code, "VALIDATION_FAILED");
  assert.equal(calls.resolved.length, 0);
});

test("approving needs the approve capability", async () => {
  const { h, calls } = setup([claim("c1", { verificationReasonCode: "ENTAILMENT_UNCERTAIN" })]);
  const r = await h.handle(ctx("VIEWER"), { sectionId: "s-1", note: NOTE, approve: true });
  assert.equal(r.ok, false);
  assert.equal(r.error.code, "FORBIDDEN");
  assert.equal(calls.resolved.length, 0);
});

test("already-resolved claims are not resolved again (idempotent)", async () => {
  const claims = [claim("c1", { verificationReasonCode: "ENTAILMENT_UNCERTAIN" })];
  const { h, calls } = setup(claims);
  await h.handle(ctx(), { sectionId: "s-1", note: NOTE });
  const r = await h.handle(ctx(), { sectionId: "s-1", note: NOTE });
  assert.equal(r.value.resolved, 0);
  assert.equal(calls.resolved.length, 1);
});
