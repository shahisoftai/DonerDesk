import assert from "node:assert/strict";
import test from "node:test";
import { MarkSummaryCurrentHandler } from "../dist/index.js";
import { ReportSection, TenantId } from "@donordesk/domain";

const ctx = { tenant: { tenantId: TenantId.create("tenant-a"), userId: "u1" }, requestId: "r" };
const ok = (value) => ({ ok: true, value });
const section = (title) => ReportSection.create({ id: "s", tenantId: "tenant-a", reportDraftId: "d", sectionTitle: title, sectionOrder: 1 });
function build(sec, draftStatus = "DRAFT") {
  const audits = [];
  const saved = [];
  const h = new MarkSummaryCurrentHandler(
    { findById: async () => ok(sec), update: async (s) => (saved.push(s), ok(s)) },
    { findById: async () => ok({ status: draftStatus, projectId: "p" }) },
    { record: async (e) => { audits.push(e); } },
    () => new Date("2026-10-06T12:00:00Z"),
  );
  return { h, audits, saved };
}

test("a summary can be marked current, audited", async () => {
  const sec = section("Executive Summary");
  const { h, audits } = build(sec);
  const r = await h.handle(ctx, "s");
  assert.equal(r.ok, true);
  assert.equal(sec.summaryCurrentAt.toISOString(), "2026-10-06T12:00:00.000Z");
  assert.equal(audits[0].eventType, "report.summary.marked_current");
});

test("other sections and approved reports are refused", async () => {
  assert.equal((await build(section("Results")).h.handle(ctx, "s")).ok, false);
  const r = await build(section("Executive Summary"), "APPROVED").h.handle(ctx, "s");
  assert.equal(r.ok, false);
  assert.match(r.error.message, /approved/);
});
