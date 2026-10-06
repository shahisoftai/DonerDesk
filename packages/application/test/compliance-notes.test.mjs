import assert from "node:assert/strict";
import test from "node:test";
import { GetComplianceNotesHandler, SaveSectionNoteHandler, UpdateReportingPeriodStoryHandler } from "../dist/index.js";
import { ReportingPeriod, TenantId } from "@donordesk/domain";

const ctx = { tenant: { tenantId: TenantId.create("tenant-a"), userId: "u1" }, requestId: "r" };
const ok = (value) => ({ ok: true, value });
const mk = (id, m) => ReportingPeriod.create({ id, tenantId: "tenant-a", projectId: "p", reportType: "MONTHLY", startDate: new Date(Date.UTC(2026, m, 1)), endDate: new Date(Date.UTC(2026, m + 1, 0)), deadline: new Date(Date.UTC(2026, m + 1, 10)) });
const sections = [{ id: "s1", title: "Executive Summary" }, { id: "s2", title: "Environmental Compliance" }, { id: "s3", title: "Branding and Marking" }];

function world() {
  const mar = mk("mar", 2); mar.setSectionNote("s2", "March: waste sorted.");
  const apr = mk("apr", 3);
  const periods = { findById: async (id) => ok(id === "apr" ? apr : mar), update: async (p) => ok(p), findPreviousPeriods: async () => ok([mar]) };
  const builder = { loadBase: async () => ok({ period: apr, templateSections: sections }) };
  const audits = [];
  return { apr, periods, builder, audits, audit: { record: async (e) => { audits.push(e); } } };
}

test("the compliance sections are listed with last month's statement and what is still missing", async () => {
  const w = world();
  const r = await new GetComplianceNotesHandler(w.builder, w.periods).handle(ctx, "apr");
  assert.deepEqual(r.value.sections.map((s) => [s.key, s.note, s.previousNote]), [["s2", "", "March: waste sorted."], ["s3", "", undefined]]);
  assert.equal(r.value.missingCount, 2);
});

test("saving a statement keeps the others, audits it and updates the count; a non-compliance key is refused", async () => {
  const w = world();
  const save = new SaveSectionNoteHandler(w.builder, w.periods, w.audit);
  const r = await save.handle(ctx, "apr", { key: "s2", note: "April: waste sorted." });
  assert.deepEqual(r.value, { missingCount: 1 });
  assert.equal(w.apr.storyContext.sectionNotes.s2, "April: waste sorted.");
  assert.equal(w.audits[0].eventType, "reporting_period.section_note_saved");
  const refused = await save.handle(ctx, "apr", { key: "s1", note: "x" });
  assert.equal(refused.ok, false);
});

test("saving the five story answers never wipes the compliance statements", async () => {
  const w = world();
  w.apr.setSectionNote("s3", "Logo everywhere.");
  await new UpdateReportingPeriodStoryHandler(w.periods, w.audit).handle(ctx, "apr", { storyContext: { achievements: "Went well." } });
  assert.equal(w.apr.storyContext.achievements, "Went well.");
  assert.equal(w.apr.storyContext.sectionNotes.s3, "Logo everywhere.");
});
