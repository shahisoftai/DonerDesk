import assert from "node:assert/strict";
import test from "node:test";
import { DeterministicPriorPeriodService } from "../dist/llm/prior-period.js";

const ok = (value) => ({ ok: true, value });

const day = (d) => new Date(`${d}T00:00:00Z`);
const prev = (id, reportType = "QUARTERLY") => ({ id, reportType, duration: { start: day("2028-01-01"), end: day("2028-03-31") } });
const current = (reportType = "QUARTERLY", scope = {}) => ({ id: "p2", reportType, scope });

function fakes(opts = {}) {
  const calls = { periods: 0, drafts: 0, sections: 0, revisions: 0 };
  const seen = [];
  const periods = {
    findById: async () => ok(opts.current ?? current()),
    findPreviousPeriods: async (...args) => (calls.periods++, seen.push(args), ok(opts.previous ?? [prev("p1")])),
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
  return { calls, seen, service: new DeterministicPriorPeriodService(periods, drafts, sections, revisions) };
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
  assert.deepEqual(results[0], [{ periodLabel: "QUARTERLY 2028-01-01 – 2028-03-31", content: "prior s1", sourceSectionTitle: "Results" }]);
  assert.deepEqual(results[1], [{ periodLabel: "QUARTERLY 2028-01-01 – 2028-03-31", content: "prior s2", sourceSectionTitle: "Lessons  learned" }]);
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
    { findById: async () => { throw new Error("db down"); }, findPreviousPeriods: async () => { throw new Error("db down"); } },
    {}, {}, {},
  );
  assert.deepEqual(await service.fetch(input(plan()), { title: "Results" }), []);
});

test("a quarterly report only asks for quarterly history", async () => {
  const { seen, service } = fakes();
  await service.fetch(input(plan()), { title: "Results" });
  assert.deepEqual(seen[0][4], { reportTypes: ["QUARTERLY"] });
});

test("activity and custom reports have no prior narrative and make no history query", async () => {
  for (const type of ["ACTIVITY", "CUSTOM"]) {
    const { calls, service } = fakes({ current: current(type) });
    assert.deepEqual(await service.fetch(input(plan()), { title: "Results" }), []);
    assert.equal(calls.periods, 0);
  }
});

test("a situation report only sees its own event series", async () => {
  const { seen, service } = fakes({ current: current("SITUATION", { eventName: "  Flood  Kandahar " }), previous: [prev("p1", "SITUATION")] });
  await service.fetch(input(plan()), { title: "Results" });
  assert.deepEqual(seen[0][4], { reportTypes: ["SITUATION"], eventKey: "flood kandahar" });
});

test("a semi-annual report falls back to at most two quarterly reports", async () => {
  const { calls, service } = fakes({ current: current("SEMI_ANNUAL"), previous: [prev("q3"), prev("q2"), prev("q1")] });
  const out = await service.fetch(input(plan()), { title: "Results" });
  assert.equal(out.length, 2);
  assert.equal(calls.drafts, 2);
});

test("a semi-annual report prefers an earlier half-year over quarterlies", async () => {
  const { calls, service } = fakes({ current: current("SEMI_ANNUAL"), previous: [prev("q3"), prev("h1", "SEMI_ANNUAL")] });
  await service.fetch(input(plan()), { title: "Results" });
  assert.equal(calls.drafts, 1);
});

test("sections match by blueprint key across languages and report types", async () => {
  const periods = { findById: async () => ok(current("SEMI_ANNUAL")), findPreviousPeriods: async () => ok([prev("q1")]) };
  const drafts = { findByReportingPeriod: async () => ok([{ id: "d1", status: "APPROVED" }]) };
  const sections = { findByReportDraft: async () => ok([{ id: "s1", sectionTitle: "Résumé exécutif", templateSectionId: "bp:quarterly:exec" }]) };
  const revisions = { findCurrentForSection: async () => ok({ content: "texte" }) };
  const service = new DeterministicPriorPeriodService(periods, drafts, sections, revisions);
  const out = await service.fetch(input(plan()), { title: "Executive Summary", templateSectionId: "bp:semi_annual:exec" });
  assert.equal(out.length, 1);
  assert.equal(out[0].content, "texte");
});

test("a leading donor number does not stop a title match", async () => {
  const periods = { findById: async () => ok(current()), findPreviousPeriods: async () => ok([prev("p1")]) };
  const drafts = { findByReportingPeriod: async () => ok([{ id: "d1", status: "APPROVED" }]) };
  const sections = { findByReportDraft: async () => ok([{ id: "s1", sectionTitle: "2.1 Results" }]) };
  const revisions = { findCurrentForSection: async () => ok({ content: "x" }) };
  const service = new DeterministicPriorPeriodService(periods, drafts, sections, revisions);
  assert.equal((await service.fetch(input(plan()), { title: "Results" })).length, 1);
});

test("a situation follow-up's 'changes' section is given the previous report's at-a-glance text", async () => {
  const periods = { findById: async () => ok(current("SITUATION", { eventName: "Flood" })), findPreviousPeriods: async () => ok([prev("p1", "SITUATION")]) };
  const drafts = { findByReportingPeriod: async () => ok([{ id: "d1", status: "APPROVED" }]) };
  const sections = { findByReportDraft: async () => ok([
    { id: "s0", sectionTitle: "Background", templateSectionId: "bp:situation:background" },
    { id: "s1", sectionTitle: "Situation at a Glance", templateSectionId: "bp:situation:overview" },
  ]) };
  const revisions = { findCurrentForSection: async (id) => ok({ content: `text of ${id}` }) };
  const service = new DeterministicPriorPeriodService(periods, drafts, sections, revisions);
  const [changes] = await service.fetch(input(plan()), { title: "Developments Since the Last Report", templateSectionId: "bp:situation:changes" });
  assert.equal(changes.content, "text of s1");
  const [glance] = await service.fetch(input(plan()), { title: "Situation at a Glance", templateSectionId: "bp:situation:overview" });
  assert.equal(glance.content, "text of s1");
});
