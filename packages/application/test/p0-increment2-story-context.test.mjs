import assert from "node:assert/strict";
import test from "node:test";
import { ReportingPeriod, parseStoryContext, STORY_CONTEXT_FIELDS } from "@donordesk/domain";
import { UpdateReportingPeriodStoryHandler } from "../dist/index.js";

/**
 * Increment 2 — "Tell the Story" structured narrative context.
 * The story is stored structurally (achievements / challenges /
 * varianceExplanations / adaptations / lessons), not as one blob, and is
 * persisted + audited via the update handler.
 */

function makePeriod(id = "period-1") {
  return ReportingPeriod.create({
    id,
    tenantId: "tenant-a",
    projectId: "proj-1",
    reportType: "QUARTERLY",
    startDate: new Date("2026-04-01"),
    endDate: new Date("2026-06-30"),
    deadline: new Date("2026-07-15"),
  });
}

test("parseStoryContext is tolerant and keeps only known fields", () => {
  const parsed = parseStoryContext(JSON.stringify({
    achievements: "Completed all trainings",
    challenges: "Flooding delayed three communities",
    bogus: "should be dropped",
    varianceExplanations: 42,
  }));
  assert.equal(parsed.achievements, "Completed all trainings");
  assert.equal(parsed.challenges, "Flooding delayed three communities");
  assert.equal(parsed.varianceExplanations, undefined, "non-string value dropped");
  assert.equal(parsed.bogus, undefined, "unknown key dropped");
  assert.deepEqual(parseStoryContext("not json"), {});
});

test("ReportingPeriod stores and returns a structured story context", () => {
  const period = makePeriod();
  period.setStoryContext({
    achievements: "All trainings delivered",
    lessons: "Early engagement reduced drop-out",
  });
  assert.equal(period.storyContext.achievements, "All trainings delivered");
  assert.equal(period.storyContext.lessons, "Early engagement reduced drop-out");
  assert.equal(period.storyContext.challenges, undefined);
});

test("UpdateReportingPeriodStoryHandler persists the structured story and audits", async () => {
  let saved;
  const periodsRepo = {
    findById: async () => ({ ok: true, value: makePeriod() }),
    update: async (p) => { saved = p; return { ok: true, value: p }; },
  };
  const auditEvents = [];
  const audit = { record: async (e) => { auditEvents.push(e); return { ok: true }; } };
  const handler = new UpdateReportingPeriodStoryHandler(periodsRepo, audit);

  const result = await handler.handle(
    { tenant: { tenantId: { toString: () => "tenant-a" }, userId: "user-1", role: "ADMIN" }, requestId: "r" },
    "period-1",
    { storyContext: { challenges: "Flooding for three weeks", adaptations: "Mobile delivery" } },
  );

  assert.ok(result.ok);
  assert.equal(saved.storyContext.challenges, "Flooding for three weeks");
  assert.equal(saved.storyContext.adaptations, "Mobile delivery");
  assert.ok(auditEvents.some((e) => e.eventType === "reporting_period.story_updated"), "story update must be audited");
  // The full field surface is available to the AI writer.
  assert.deepEqual(STORY_CONTEXT_FIELDS, ["achievements", "challenges", "varianceExplanations", "adaptations", "lessons"]);
});
