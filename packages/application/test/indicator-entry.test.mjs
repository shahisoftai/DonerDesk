import assert from "node:assert/strict";
import test from "node:test";
import {
  BulkUpsertIndicatorUpdatesHandler,
  ListPeriodIndicatorsHandler,
  ParseIndicatorSheetHandler,
} from "../dist/index.js";
import { TenantId, Indicator, IndicatorUpdate, ReportingPeriod, ReportStatus } from "@donordesk/domain";

const ctx = { tenant: { tenantId: TenantId.create("tenant-a"), userId: "user-1", role: "ADMIN" }, requestId: "r-1" };

function makeIndicator(id = "ind-1", code = "IND-1") {
  return Indicator.create({
    id,
    tenantId: "tenant-a",
    projectId: "proj-1",
    logframeItemId: "item-1",
    code,
    name: `Indicator ${code}`,
    type: "NUMBER",
    baseline: "0",
    target: "100",
    unit: "people",
  });
}

function makePeriod() {
  return ReportingPeriod.create({
    id: "period-1",
    tenantId: "tenant-a",
    projectId: "proj-1",
    reportType: "MONTHLY",
    startDate: new Date("2026-08-01T00:00:00Z"),
    endDate: new Date("2026-08-31T00:00:00Z"),
    deadline: new Date("2026-09-15T00:00:00Z"),
  });
}

const ids = {
  generate: () => `upd-${Math.floor(Math.random() * 1e9)}`,
};

const audit = {
  record: async () => ({ ok: true, value: undefined }),
};

function periodRepo(period) {
  return { findById: async () => ({ ok: true, value: period }) };
}

function indicatorRepo(indicators) {
  return { findByProject: async () => ({ ok: true, value: indicators }) };
}

test("bulk upsert creates draft updates for indicators without existing values", async () => {
  const indicator = makeIndicator();
  const repo = {
    findByIndicatorAndPeriod: async () => ({ ok: true, value: null }),
    create: async (u) => ({ ok: true, value: u }),
    update: async (u) => ({ ok: true, value: u }),
  };
  const handler = new BulkUpsertIndicatorUpdatesHandler(ids, repo, indicatorRepo([indicator]), periodRepo(makePeriod()), audit);

  const result = await handler.handle(ctx, {
    reportingPeriodId: "period-1",
    updates: [{ indicatorId: "ind-1", periodAchievement: "25", cumulativeAchievement: "25" }],
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.saved, 1);
  assert.equal(result.value.skipped, 0);
});

test("bulk upsert edits an existing draft instead of creating a second row", async () => {
  const indicator = makeIndicator();
  const existing = IndicatorUpdate.create({
    id: "upd-1",
    tenantId: "tenant-a",
    indicatorId: "ind-1",
    reportingPeriodId: "period-1",
    periodAchievement: "10",
    cumulativeAchievement: "10",
    createdById: "user-1",
  });
  const repo = {
    findByIndicatorAndPeriod: async () => ({ ok: true, value: existing }),
    create: async (u) => ({ ok: true, value: u }),
    update: async (u) => ({ ok: true, value: u }),
  };
  const handler = new BulkUpsertIndicatorUpdatesHandler(ids, repo, indicatorRepo([indicator]), periodRepo(makePeriod()), audit);

  const result = await handler.handle(ctx, {
    reportingPeriodId: "period-1",
    updates: [{ indicatorId: "ind-1", periodAchievement: "25", cumulativeAchievement: "35" }],
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.saved, 1);
  assert.equal(existing.periodAchievement, "25");
  assert.equal(existing.cumulativeAchievement, "35");
});

test("bulk upsert leaves verified rows untouched and counts them as skipped", async () => {
  const indicator = makeIndicator();
  const verified = IndicatorUpdate.create({
    id: "upd-1",
    tenantId: "tenant-a",
    indicatorId: "ind-1",
    reportingPeriodId: "period-1",
    periodAchievement: "50",
    cumulativeAchievement: "50",
    createdById: "user-1",
  });
  verified.submit();
  verified.verify("verifier-1");
  const repo = {
    findByIndicatorAndPeriod: async () => ({ ok: true, value: verified }),
    create: async (u) => ({ ok: true, value: u }),
    update: async (u) => ({ ok: true, value: u }),
  };
  const handler = new BulkUpsertIndicatorUpdatesHandler(ids, repo, indicatorRepo([indicator]), periodRepo(makePeriod()), audit);

  const result = await handler.handle(ctx, {
    reportingPeriodId: "period-1",
    updates: [{ indicatorId: "ind-1", periodAchievement: "99", cumulativeAchievement: "99" }],
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.saved, 0);
  assert.equal(result.value.skipped, 1);
  assert.equal(verified.periodAchievement, "50");
});

test("bulk upsert rejects writes to a closed reporting period", async () => {
  const period = makePeriod();
  period.transitionTo(ReportStatus.create("CLOSED"));
  const repo = {
    findByIndicatorAndPeriod: async () => ({ ok: true, value: null }),
    create: async (u) => ({ ok: true, value: u }),
    update: async (u) => ({ ok: true, value: u }),
  };
  const handler = new BulkUpsertIndicatorUpdatesHandler(ids, repo, indicatorRepo([]), periodRepo(period), audit);

  const result = await handler.handle(ctx, { reportingPeriodId: "period-1", updates: [] });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "CONFLICT");
});

test("list period indicators merges logframe indicators with their updates", async () => {
  const indicator = makeIndicator();
  const update = IndicatorUpdate.create({
    id: "upd-1",
    tenantId: "tenant-a",
    indicatorId: "ind-1",
    reportingPeriodId: "period-1",
    periodAchievement: "25",
    cumulativeAchievement: "25",
    createdById: "user-1",
  });
  const handler = new ListPeriodIndicatorsHandler(
    periodRepo(makePeriod()),
    {
      findByProject: async () => ({
        ok: true,
        value: [{ id: "item-1", level: "OUTPUT", code: "OUT1", title: "Output one" }],
      }),
    },
    indicatorRepo([indicator]),
    { findByReportingPeriod: async () => ({ ok: true, value: [update] }) },
  );

  const result = await handler.handle(ctx, "period-1");
  assert.equal(result.ok, true);
  assert.equal(result.value.indicators.length, 1);
  const row = result.value.indicators[0];
  assert.equal(row.code, "IND-1");
  assert.equal(row.logframeLevel, "OUTPUT");
  assert.equal(row.update.periodAchievement, "25");
  assert.equal(row.update.verificationStatus, "DRAFT");
});

test("parse indicator sheet maps rows by indicator code and flags unknown codes", async () => {
  const indicator = makeIndicator();
  const handler = new ParseIndicatorSheetHandler(
    periodRepo(makePeriod()),
    indicatorRepo([indicator]),
    {
      readSheet: async () => ({
        ok: true,
        value: {
          headers: ["Code", "Period achievement", "Cumulative"],
          rows: [
            ["IND-1", "25", "25"],
            ["NOPE-9", "1", "1"],
          ],
        },
      }),
    },
  );

  const result = await handler.handle(ctx, { reportingPeriodId: "period-1", sheetUrl: "https://docs.google.com/spreadsheets/d/abc123def456" });
  assert.equal(result.ok, true);
  assert.equal(result.value.rows.length, 2);
  assert.equal(result.value.rows[0].matched, true);
  assert.equal(result.value.rows[0].indicatorId, "ind-1");
  assert.equal(result.value.rows[1].matched, false);
  assert.equal(result.value.warnings.some((w) => w.includes("NOPE-9")), true);
});

test("bulk save rejects a breakdown that does not add up, before writing anything", async () => {
  const indicator = makeIndicator("ind-d", "D-1");
  const period = makePeriod();
  const written = [];
  const repo = {
    async findByIndicatorAndPeriod() { return { ok: true, value: null }; },
    async create(u) { written.push(u); return { ok: true, value: u }; },
    async update(u) { written.push(u); return { ok: true, value: u }; },
  };
  const handler = new BulkUpsertIndicatorUpdatesHandler(
    ids,
    repo,
    { async findByProject() { return { ok: true, value: [indicator, makeIndicator("ind-ok", "OK-1")] }; } },
    { async findById() { return { ok: true, value: period }; } },
    { async record() {} },
  );
  const bad = await handler.handle(ctx, {
    reportingPeriodId: "period-1",
    updates: [
      { indicatorId: "ind-ok", periodAchievement: "5", cumulativeAchievement: "5" },
      {
        indicatorId: "ind-d", periodAchievement: "10", cumulativeAchievement: "10",
        disaggregation: [{ dimension: "SEX", category: "Female", value: "3" }, { dimension: "SEX", category: "Male", value: "3" }],
      },
    ],
  });
  assert.equal(bad.ok, false);
  assert.match(bad.error.message, /^D-1: SEX breakdown adds up to 6/);
  assert.equal(written.length, 0);

  const good = await handler.handle(ctx, {
    reportingPeriodId: "period-1",
    updates: [{
      indicatorId: "ind-d", periodAchievement: "10", cumulativeAchievement: "10",
      disaggregation: [{ dimension: "SEX", category: " Female ", value: "4" }, { dimension: "SEX", category: "Male", value: "6" }],
    }],
  });
  assert.equal(good.ok, true);
  assert.deepEqual(written[0].disaggregation.map((e) => e.category), ["Female", "Male"]);
});

test("list period indicators is scoped to the report: activity → its activities' indicators, situation → none", async () => {
  const logframe = { findByProject: async () => ({ ok: true, value: [] }) };
  const updates = { findByReportingPeriod: async () => ({ ok: true, value: [] }) };
  const indicators = indicatorRepo([makeIndicator("ind-1", "IND-1"), makeIndicator("ind-2", "IND-2")]);
  const acts = [
    { id: "a1", indicatorId: "ind-2", status: "ACCEPTED", activityDate: new Date("2026-08-10T00:00:00Z") },
    { id: "a2", indicatorId: undefined, status: "SUBMITTED", activityDate: new Date("2026-08-12T00:00:00Z") },
  ];
  const activities = { findByProject: async () => ({ ok: true, value: acts }), findByReportingPeriod: async () => ({ ok: true, value: [] }) };
  const make = (reportType, scopeJson) =>
    ReportingPeriod.create({
      id: "period-1", tenantId: "tenant-a", projectId: "proj-1", reportType, scopeJson,
      startDate: new Date("2026-08-01T00:00:00Z"), endDate: new Date("2026-08-31T00:00:00Z"), deadline: new Date("2026-09-15T00:00:00Z"),
    });

  const activity = await new ListPeriodIndicatorsHandler(periodRepo(make("ACTIVITY", JSON.stringify({ activityIds: ["a1", "a2"] }))), logframe, indicators, updates, activities).handle(ctx, "period-1");
  assert.deepEqual(activity.value.indicators.map((r) => r.id), ["ind-2"]);
  assert.deepEqual(activity.value.scope, { activityCount: 2, acceptedActivityCount: 1 });

  const situation = await new ListPeriodIndicatorsHandler(periodRepo(make("SITUATION", JSON.stringify({ eventName: "Flood", situationDate: "2026-08-31" }))), logframe, indicators, updates, activities).handle(ctx, "period-1");
  assert.equal(situation.value.indicators.length, 0);
  assert.equal(situation.value.scope.activityCount, 2);

  const monthly = await new ListPeriodIndicatorsHandler(periodRepo(make("MONTHLY")), logframe, indicators, updates, activities).handle(ctx, "period-1");
  assert.equal(monthly.value.indicators.length, 2);
  assert.equal(monthly.value.scope, undefined);
});
