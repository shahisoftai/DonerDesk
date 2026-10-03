import assert from "node:assert/strict";
import test from "node:test";
import { DeterministicPriorPeriodService } from "../dist/llm/prior-period.js";

const ok = (value) => ({ ok: true, value });

function fakes() {
  const calls = { periods: 0, drafts: 0, sections: 0, revisions: 0 };
  const periods = {
    findPreviousPeriods: async () => (calls.periods++, ok([{ id: "p1", reportType: "Q1" }])),
  };
  const drafts = {
    findByReportingPeriod: async () => (calls.drafts++, ok([{ id: "d1", status: "APPROVED" }])),
  };
  const sections = {
    findByReportDraft: async () =>
      (calls.sections++, ok([
        { id: "s1", sectionTitle: "Results" },
        { id: "s2", sectionTitle: "Lessons  learned" },
      ])),
  };
  const revisions = {
    findCurrentForSection: async (id) => (calls.revisions++, ok({ content: `prior ${id}` })),
  };
  return { calls, service: new DeterministicPriorPeriodService(periods, drafts, sections, revisions) };
}

const input = (plan) => ({ reportPlan: plan });
const plan = () => ({ projectId: "proj", reportingPeriodId: "p2", tenantId: "t1" });

test("prior-period history is loaded once per report plan, revisions per section", async () => {
  const { calls, service } = fakes();
  const p = plan();
  const results = await Promise.all([
    service.fetch(input(p), { title: "Results" }),
    service.fetch(input(p), { title: "lessons learned" }),
    service.fetch(input(p), { title: "Annex" }),
  ]);
  assert.deepEqual(results[0], [{ periodLabel: "Q1", content: "prior s1", sourceSectionTitle: "Results" }]);
  assert.deepEqual(results[1], [{ periodLabel: "Q1", content: "prior s2", sourceSectionTitle: "Lessons  learned" }]);
  assert.deepEqual(results[2], []);
  assert.deepEqual(calls, { periods: 1, drafts: 1, sections: 1, revisions: 2 });
});

test("a new report plan reloads the history", async () => {
  const { calls, service } = fakes();
  await service.fetch(input(plan()), { title: "Results" });
  await service.fetch(input(plan()), { title: "Results" });
  assert.equal(calls.periods, 2);
});

test("a failing repository degrades to no prior narrative", async () => {
  const service = new DeterministicPriorPeriodService(
    { findPreviousPeriods: async () => { throw new Error("db down"); } },
    {}, {}, {},
  );
  assert.deepEqual(await service.fetch(input(plan()), { title: "Results" }), []);
});
