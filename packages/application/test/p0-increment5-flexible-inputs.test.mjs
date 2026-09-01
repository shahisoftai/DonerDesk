import assert from "node:assert/strict";
import test from "node:test";
import {
  ImportPeriodIndicatorValuesHandler,
  ProposeFieldReportExtractionHandler,
  ApplyFieldReportExtractionHandler,
} from "../dist/index.js";

const ctx = { tenant: { tenantId: { toString: () => "tenant-a" }, userId: "user-1", role: "ADMIN" }, requestId: "r" };

function indicatorRepo(indicators) {
  return {
    findByProject: async () => ({ ok: true, value: indicators }),
  };
}

/**
 * Increment 5 — Flexible inputs. Everything feeds the existing structured
 * model (IndicatorUpdate / ActivityUpdate / ReportingPeriod.storyContext).
 * Extraction and persistence are separate: nothing is written until the user
 * confirms.
 */

test("Increment5 import: preview maps rows and flags unmappable ones (no write)", async () => {
  const updates = {
    findByIndicatorAndPeriod: async () => ({ ok: true, value: null }),
    create: async () => ({ ok: true }),
    update: async () => ({ ok: true }),
  };
  let audit = 0;
  const handler = new ImportPeriodIndicatorValuesHandler(
    { generate: () => `id-${Math.random()}` },
    indicatorRepo([{ id: "ind-1", code: "OUT-1" }, { id: "ind-2", code: "OUT-2" }]),
    updates,
    { record: async () => { audit++; return { ok: true }; } },
  );
  const result = await handler.preview(ctx, {
    projectId: "proj-1",
    reportingPeriodId: "period-1",
    rows: [["Indicator code", "Period achievement"], ["OUT-1", "30"], ["OUT-2", "not-a-number"], ["OUT-9", "5"]],
  });
  assert.ok(result.ok);
  assert.equal(result.value.totalRows, 3);
  assert.equal(result.value.readyRows, 1, "only OUT-1=30 is ready");
  assert.equal(result.value.errorRows, 2);
  assert.equal(audit, 0, "preview must not write or audit");
});

test("Increment5 import: confirm creates then updates the existing IndicatorUpdate model", async () => {
  const existingUpdate = { edit: () => {}, submit: () => {}, periodAchievement: "30" };
  const updates = {
    findByIndicatorAndPeriod: async () => ({ ok: true, value: null }),
    create: async (u) => { created.push(u); return { ok: true, value: u }; },
    update: async (u) => { updated.push(u); return { ok: true, value: u }; },
  };
  const created = [];
  const updated = [];
  const handler = new ImportPeriodIndicatorValuesHandler(
    { generate: () => `id-${Math.random()}` },
    indicatorRepo([{ id: "ind-1", code: "OUT-1" }]),
    updates,
    { record: async () => ({ ok: true }) },
  );
  // First confirm: create.
  let r = await handler.confirm(ctx, { projectId: "proj-1", reportingPeriodId: "period-1", rows: [], items: [{ indicatorCode: "OUT-1", periodAchievement: "30" }] });
  assert.ok(r.ok);
  assert.equal(r.value.created, 1);
  // Second confirm on a period that already has an update: update.
  updates.findByIndicatorAndPeriod = async () => ({ ok: true, value: existingUpdate });
  r = await handler.confirm(ctx, { projectId: "proj-1", reportingPeriodId: "period-1", rows: [], items: [{ indicatorCode: "OUT-1", periodAchievement: "35" }] });
  assert.ok(r.ok);
  assert.equal(r.value.updated, 1);
});

test("Increment5 import: a verified update is not silently overwritten (clear error, no throw)", async () => {
  // Existing update is VERIFIED — edit() throws; confirm must report it, not fail the import.
  const verifiedUpdate = { edit: () => { throw new Error("Verified updates cannot be edited"); }, submit: () => {} };
  const updates = {
    findByIndicatorAndPeriod: async () => ({ ok: true, value: verifiedUpdate }),
    create: async () => ({ ok: true, value: {} }),
    update: async () => ({ ok: true, value: {} }),
  };
  const handler = new ImportPeriodIndicatorValuesHandler(
    { generate: () => `id-${Math.random()}` },
    indicatorRepo([{ id: "ind-1", code: "OUT-1" }]),
    updates,
    { record: async () => ({ ok: true }) },
  );
  const r = await handler.confirm(ctx, { projectId: "proj-1", reportingPeriodId: "period-1", items: [{ indicatorCode: "OUT-1", periodAchievement: "32" }] });
  assert.ok(r.ok, "confirm must not throw for a verified update");
  assert.equal(r.value.created + r.value.updated, 0, "verified update must not be auto-overwritten");
  assert.ok(r.value.errors.some((e) => /verified/.test(e)), "must surface a clear 'verified' message");
});

test("Increment5 field report: propose returns proposals, never writes", async () => {
  const handler = new ProposeFieldReportExtractionHandler();
  const r = await handler.handle(ctx, "OUT-1 reached 30 centres this quarter. Flooding delayed access for three weeks.");
  assert.ok(r.ok);
  assert.ok(r.value.indicatorAchievements.some((i) => i.indicatorCode === "OUT-1" && i.value === "30"));
  assert.ok(r.value.story.some((s) => s.field === "challenges"));
});

test("Increment5 field report: apply persists only confirmed items into existing model", async () => {
  const updates = { findByIndicatorAndPeriod: async () => ({ ok: true, value: null }), create: async () => ({ ok: true, value: {} }), update: async () => ({ ok: true, value: {} }) };
  let activityCreated = 0;
  const activities = { create: async () => { activityCreated++; return { ok: true, value: {} }; } };
  let storySaved = false;
  const periods = {
    findById: async () => ({ ok: true, value: { storyContext: { challenges: "old" }, setStoryContext() {} } }),
    update: async (p) => { storySaved = true; return { ok: true, value: p }; },
  };
  const handler = new ApplyFieldReportExtractionHandler(
    { generate: () => `id-${Math.random()}` },
    indicatorRepo([{ id: "ind-1", code: "OUT-1" }]),
    updates,
    activities,
    periods,
    { record: async () => ({ ok: true }) },
  );
  const r = await handler.handle(ctx, {
    projectId: "proj-1",
    reportingPeriodId: "period-1",
    indicatorAchievements: [{ indicatorCode: "OUT-1", value: "30" }],
    activities: [{ title: "Teacher training", date: "2026-05-12" }],
    story: { challenges: "Flooding for three weeks" },
  });
  assert.ok(r.ok);
  assert.equal(r.value.indicatorsCreated, 1);
  assert.equal(activityCreated, 1);
  assert.ok(storySaved, "confirmed story context must be merged and saved");
});
