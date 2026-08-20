import assert from "node:assert/strict";
import test from "node:test";
import { ReorderReportSectionsHandler } from "../dist/index.js";
import { ReportDraft, ReportSection, TenantId } from "@donordesk/domain";

const tenant = TenantId.create("tenant-a");
const ctx = { tenant, userId: "user-1", requestId: "req-1" };

function makeDraft(id = "draft-1", status = "DRAFT") {
  if (status !== "DRAFT") {
    return ReportDraft.rehydrate({
      id,
      tenantId: tenant.toString(),
      projectId: "proj-1",
      createdAt: new Date(),
      props: {
        reportingPeriodId: "period-1",
        title: "Q3 Report",
        status: status,
        version: 1,
        generatedByAi: false,
        createdById: "user-1",
      },
    });
  }
  return ReportDraft.create({
    id,
    tenantId: tenant.toString(),
    projectId: "proj-1",
    reportingPeriodId: "period-1",
    title: "Q3 Report",
    generatedByAi: false,
    createdById: "user-1",
  });
}

function makeSection(id, order) {
  return ReportSection.create({
    id,
    tenantId: tenant.toString(),
    reportDraftId: "draft-1",
    sectionTitle: `Section ${id}`,
    sectionOrder: order,
  });
}

function inMemoryRepos(sections, draft) {
  const saved = new Map(sections.map((s) => [s.id, s]));
  return {
    drafts: {
      findById: async () => ({ ok: true, value: draft }),
    },
    sections: {
      findByReportDraft: async () => ({ ok: true, value: [...saved.values()].sort((a, b) => a.sectionOrder - b.sectionOrder) }),
      update: async (s) => {
        saved.set(s.id, s);
        return { ok: true, value: s };
      },
    },
  };
}

function auditRecorder() {
  const events = [];
  return {
    events,
    record: async (event) => {
      events.push(event);
      return { ok: true, value: undefined };
    },
  };
}

test("reorderReportSections persists the submitted order as sequential sectionOrder", async () => {
  const sections = [makeSection("s1", 0), makeSection("s2", 1), makeSection("s3", 2), makeSection("s4", 3), makeSection("s5", 4)];
  const repos = inMemoryRepos(sections, makeDraft());
  const audit = auditRecorder();
  const handler = new ReorderReportSectionsHandler(repos.drafts, repos.sections, audit);

  // Move section 5 to position 3 (0-based index 2).
  const result = await handler.handle(ctx, "draft-1", ["s1", "s2", "s5", "s3", "s4"]);
  assert.equal(result.ok, true);
  assert.deepEqual(result.value.sectionIds, ["s1", "s2", "s5", "s3", "s4"]);

  const after = await repos.sections.findByReportDraft("draft-1", tenant);
  const ordered = after.value.map((s) => s.id);
  assert.deepEqual(ordered, ["s1", "s2", "s5", "s3", "s4"]);
  const orderOf = Object.fromEntries(after.value.map((s) => [s.id, s.sectionOrder]));
  assert.deepEqual(orderOf, { s1: 0, s2: 1, s5: 2, s3: 3, s4: 4 });

  assert.equal(audit.events.length, 1);
  assert.equal(audit.events[0].eventType, "report.section.reordered");
  assert.equal(audit.events[0].entityId, "draft-1");
});

test("reorderReportSections rejects a mismatched section set", async () => {
  const sections = [makeSection("s1", 0), makeSection("s2", 1), makeSection("s3", 2)];
  const repos = inMemoryRepos(sections, makeDraft());
  const audit = auditRecorder();
  const handler = new ReorderReportSectionsHandler(repos.drafts, repos.sections, audit);

  const missing = await handler.handle(ctx, "draft-1", ["s1", "s2"]);
  assert.equal(missing.ok, false);

  const extra = await handler.handle(ctx, "draft-1", ["s1", "s2", "s3", "s4"]);
  assert.equal(extra.ok, false);

  const duplicate = await handler.handle(ctx, "draft-1", ["s1", "s1", "s3"]);
  assert.equal(duplicate.ok, false);

  assert.equal(audit.events.length, 0);
});

test("reorderReportSections rejects reordering a non-draft report", async () => {
  const sections = [makeSection("s1", 0), makeSection("s2", 1)];
  const repos = inMemoryRepos(sections, makeDraft("draft-1", "UNDER_REVIEW"));
  const audit = auditRecorder();
  const handler = new ReorderReportSectionsHandler(repos.drafts, repos.sections, audit);

  const result = await handler.handle(ctx, "draft-1", ["s2", "s1"]);
  assert.equal(result.ok, false);
  assert.equal(audit.events.length, 0);
});
