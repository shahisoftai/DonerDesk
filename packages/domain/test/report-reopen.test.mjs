import assert from "node:assert/strict";
import test from "node:test";
import { ReportDraft, ReportingPeriod } from "../dist/index.js";

const draft = (over = {}) => ReportDraft.create({ id: "d", tenantId: "t", projectId: "p", reportingPeriodId: "rp", title: "Report", generatedByAi: true, createdById: "u", ...over });
const approved = () => { const d = draft(); d.requestReview(); d.approve("approver"); return d; };

test("an approved report can be reopened: it is a draft again and its approval is cleared", () => {
  const d = approved();
  assert.equal(d.status, "APPROVED");
  d.reopen();
  assert.equal(d.status, "DRAFT");
  assert.equal(d.approvedById, undefined);
  assert.equal(d.approvedAt, undefined);
  // and the normal path works again
  d.requestReview();
  d.approve("someone-else");
  assert.equal(d.status, "APPROVED");
});

test("exported and submitted reports can be reopened too", () => {
  const exported = approved(); exported.markExported(); exported.reopen();
  assert.equal(exported.status, "DRAFT");
  const submitted = ReportDraft.rehydrate({ id: "d", tenantId: "t", projectId: "p", createdAt: new Date(), props: { reportingPeriodId: "rp", title: "R", status: "SUBMITTED", version: 1, generatedByAi: true, createdById: "u", approvedById: "a", approvedAt: new Date() } });
  submitted.reopen();
  assert.equal(submitted.status, "DRAFT");
});

test("a report that is already open, or an older version, cannot be reopened", () => {
  assert.throws(() => draft().reopen(), /already open for changes/);
  const underReview = draft(); underReview.requestReview();
  assert.throws(() => underReview.reopen(), /already open for changes/);
  const old = draft(); old.supersede(new Date());
  assert.throws(() => old.reopen(), /older version/);
});

test("reopening takes an approved or submitted period back to 'draft generated', and leaves other states alone", () => {
  const period = () => ReportingPeriod.create({ id: "p", tenantId: "t", projectId: "pr", reportType: "MONTHLY", startDate: new Date("2026-01-01"), endDate: new Date("2026-01-31"), deadline: new Date("2026-02-10") });
  const a = period(); a.advanceStatus("APPROVED"); a.reopenStatus();
  assert.equal(a.status.value, "DRAFT_GENERATED");
  const s = period(); s.advanceStatus("SUBMITTED"); s.reopenStatus();
  assert.equal(s.status.value, "DRAFT_GENERATED");
  const u = period(); u.advanceStatus("UNDER_REVIEW"); u.reopenStatus();
  assert.equal(u.status.value, "UNDER_REVIEW");
  const c = period(); c.advanceStatus("CLOSED"); c.reopenStatus();
  assert.equal(c.status.value, "CLOSED");
});
