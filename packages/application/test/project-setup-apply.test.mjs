// Phase 36.3: the appliers (one contract, run per area) and Preview/Apply with fake handlers and repositories.
// Pins: dry runs write nothing; apply creates the project once, stops at the first failed area, and resumes after it.
import test from "node:test";
import assert from "node:assert/strict";
import { SETUP_AREA_KEYS, TenantId } from "@donordesk/domain";
import {
  ApplySetupProposalHandler, PreviewSetupApplyHandler, FactsApplier, LogframeApplier, IndicatorsApplier, PeriodsApplier,
  PlanApplier, PlacesApplier, FundingBudgetApplier, RisksApplier, emptySetupProposal, proposalExpiry,
} from "../dist/index.js";

const tenantId = TenantId.create("tenant-a");
const NOW = new Date("2026-10-31T08:00:00Z");
const ctx = { tenant: { tenantId, userId: "u1", role: "ADMIN" }, requestId: "r" };
const ok = (value) => ({ ok: true, value });
const A = (value) => ({ value, sourceQuote: "q", sourceRef: null, confidence: "HIGH", status: "ACCEPTED" });

function readyProposal() {
  const p = emptySetupProposal();
  p.facts.name = A("Blue Water");
  p.facts.startDate = A("2027-03-01");
  p.facts.endDate = A("2029-02-28");
  p.logframe = [A({ level: "GOAL", code: "1", title: "Health", description: null, parentCode: null })];
  p.indicators = [A({ code: "1.a", title: "People", logframeCode: "1", type: "NUMBER", unit: null, baseline: "0", target: "10", targetSchedule: null, frequency: null, direction: null, disaggregation: null, meansOfVerification: null })];
  p.periods = [A({ type: "QUARTERLY", start: null, end: null })];
  p.plan = [A({ title: "Rehab", logframeCode: "1", start: "2027-04-01", end: "2027-05-01", location: null, lead: null })];
  p.places = [A({ name: "Uganda", adminLevel: 0, parentName: null, latitude: null, longitude: null })];
  p.funding = [A({ sourceName: "EU", amount: "1,250,000", currency: "EUR" })];
  p.risks = [A({ kind: "RISK", title: "Floods", seriousness: "high", mitigation: "dry season" })];
  return p;
}

/** Fake versions of every delegated handler, counting calls. */
function fakes({ failPlan = false } = {}) {
  const calls = {};
  const hit = (name) => { calls[name] = (calls[name] ?? 0) + 1; };
  const risks = [];
  const fundingRows = [];
  return {
    calls,
    appliers: [
      new FactsApplier(),
      new LogframeApplier({ handle: async () => { hit("logframe"); return ok({ created: 1, skipped: 0, warnings: [] }); } }),
      new IndicatorsApplier({ handle: async () => { hit("indicators"); return ok({ created: 1, skipped: 0, warnings: [] }); } }),
      new PeriodsApplier({ handle: async () => { hit("periods"); return ok({ created: [{}, {}], failed: [] }); } }),
      new PlanApplier({ handle: async () => { hit("plan"); return failPlan ? ok({ created: 0, skipped: 0, warnings: [], problems: ["row 1: give it a title"] }) : ok({ created: 1, skipped: 0, warnings: [], problems: [] }); } }),
      new PlacesApplier({ handle: async () => { hit("places"); return ok({ create: [{}], skipped: [], problems: [], applied: true }); } }),
      new FundingBudgetApplier({
        sources: async () => ok([]),
        createSource: async () => { hit("source"); return ok({ id: "src-1" }); },
        existing: async () => ok(fundingRows),
        add: async (_c, _p, input) => { hit("funding"); fundingRows.push({ fundingSourceId: input.fundingSourceId, amountText: input.amount, currency: input.currency }); return ok({ id: "f" }); },
        projectStart: async () => ok("2027-03-01"),
      }),
      new RisksApplier({
        list: async () => ok(risks),
        create: async (_c, _p, input) => { hit("risk"); risks.push(input); return ok({ id: "r" }); },
      }),
    ],
  };
}

function repos(proposal) {
  let stored = { id: "p1", tenantId, createdById: "u1", status: "READY", sourceName: "d", sourceStorageKey: "drive:file-1", sourceHash: "h", sourceLength: 1, proposal, problems: [], createdAt: NOW, updatedAt: NOW, expiresAt: proposalExpiry(NOW) };
  const runs = new Map();
  let n = 0;
  return {
    get stored() { return stored; },
    proposals: {
      findById: async () => ok(stored),
      update: async (p, expected) => {
        if (expected && expected.getTime() !== stored.updatedAt.getTime()) return ok(false);
        stored = { ...p, updatedAt: new Date(stored.updatedAt.getTime() + 1000) };
        return ok(true);
      },
    },
    runs: {
      start: async (r) => { runs.set(r.id, { ...r }); return ok(undefined); },
      finish: async (id) => { runs.get(id).status = "FINISHED"; return ok(undefined); },
      fail: async (id) => { runs.get(id).status = "FAILED"; return ok(undefined); },
      listByProposal: async () => ok([...runs.values()]),
    },
    ids: { generate: () => `id-${++n}` },
    documents: {
      moves: [],
      failMoves: false,
      async moveToProject(_tenant, fileId, projectId) {
        this.moves.push({ fileId, projectId });
        return this.failMoves ? { ok: false, error: { code: "INVARIANT_VIOLATION", message: "drive down" } } : ok({ folder: "00-Project-Documents", webLink: "https://drive.example/doc" });
      },
    },
  };
}

const clock = { now: () => NOW };
const audit = { events: [], record: async (e) => { audit.events.push(e.eventType); } };
const everyArea = Object.fromEntries(SETUP_AREA_KEYS.map((a) => [a, true]));
const projectForm = { title: "Blue Water", projectCode: "BW", donorName: "EU", implementingOrganization: "Org", country: "Uganda", sector: "WASH", startDate: "2027-03-01T00:00:00.000Z", endDate: "2029-02-28T00:00:00.000Z", reportingFrequency: "QUARTERLY" };

test("every area has an applier, and every applier honours the contract: a dry run writes nothing", async () => {
  const f = fakes();
  assert.deepEqual(f.appliers.map((a) => a.area).sort(), [...SETUP_AREA_KEYS].sort());
  for (const applier of f.appliers) {
    const dry = await applier.dryRun({ auth: ctx, proposalId: "p1" }, readyProposal());
    assert.equal(dry.ok, true, applier.area);
    assert.ok(Number.isInteger(dry.value.items) && Array.isArray(dry.value.notes), applier.area);
  }
  assert.deepEqual(f.calls, {}, "no delegated handler was called by a dry run");
});

test("preview saves nothing and returns the draft, what is missing and each area's count", async () => {
  const r = repos(readyProposal());
  const f = fakes();
  const before = r.stored;
  const view = await new PreviewSetupApplyHandler(r.proposals, f.appliers, clock).handle(ctx, "p1", everyArea);
  assert.equal(view.ok, true);
  assert.equal(r.stored, before);
  assert.deepEqual(f.calls, {});
  assert.equal(view.value.draft.title, "Blue Water");
  assert.ok(view.value.missing.includes("implementingOrganization"));
  assert.deepEqual(view.value.areas.map((a) => a.area), ["FACTS", "LOGFRAME", "INDICATORS", "PERIODS", "PLACES", "PLAN", "FUNDING_BUDGET", "RISKS"]);
});

test("apply creates the project once and runs every area through its own handler", async () => {
  const r = repos(readyProposal());
  const f = fakes();
  let created = 0;
  const creator = { handle: async () => { created += 1; return ok({ id: "proj-1" }); } };
  const h = new ApplySetupProposalHandler(r.proposals, r.runs, f.appliers, creator, r.documents, audit, clock, r.ids);
  const res = await h.handle(ctx, "p1", { project: projectForm, areas: everyArea });
  assert.equal(res.ok, true, res.error?.message);
  assert.equal(res.value.status, "APPLIED");
  assert.equal(created, 1);
  assert.equal(r.stored.status, "APPLIED");
  assert.equal(r.stored.appliedProjectId, "proj-1");
  assert.deepEqual(f.calls, { logframe: 1, indicators: 1, periods: 1, plan: 1, places: 1, source: 1, funding: 1, risk: 1 });
  const again = await h.handle(ctx, "p1", { project: projectForm, areas: everyArea });
  assert.equal(again.ok, false, "an applied proposal is not applied again");
});

test("a failed area stops the run, keeps earlier areas, and applying again resumes after the last finished one", async () => {
  const r = repos(readyProposal());
  let f = fakes({ failPlan: true });
  let created = 0;
  const creator = { handle: async () => { created += 1; return ok({ id: "proj-1" }); } };
  let res = await new ApplySetupProposalHandler(r.proposals, r.runs, f.appliers, creator, r.documents, audit, clock, r.ids).handle(ctx, "p1", { project: projectForm, areas: everyArea });
  assert.equal(res.value.status, "PARTIAL");
  assert.deepEqual(res.value.areas.map((a) => a.status), ["APPLIED", "APPLIED", "APPLIED", "APPLIED", "APPLIED", "FAILED", "NOT_RUN", "NOT_RUN"]);
  assert.match(res.value.areas[5].error, /row 1/);
  assert.equal(r.stored.status, "PARTIAL");
  f = fakes();
  res = await new ApplySetupProposalHandler(r.proposals, r.runs, f.appliers, creator, r.documents, audit, clock, r.ids).handle(ctx, "p1", { project: projectForm, areas: everyArea });
  assert.equal(res.value.status, "APPLIED");
  assert.equal(created, 1, "the project is not created twice");
  assert.equal(f.calls.logframe, undefined, "finished areas are not run again");
  assert.equal(f.calls.plan, 1);
});

test("apply refuses: hard problems, facts not accepted, a project the creator refuses (nothing else runs), a stale claim", async () => {
  const bad = readyProposal();
  bad.logframe.push(A({ level: "GOAL", code: "1", title: "Duplicate", description: null, parentCode: null }));
  let r = repos(bad);
  let f = fakes();
  const creator = { handle: async () => ok({ id: "x" }) };
  assert.equal((await new ApplySetupProposalHandler(r.proposals, r.runs, f.appliers, creator, r.documents, audit, clock, r.ids).handle(ctx, "p1", { project: projectForm, areas: everyArea })).ok, false);

  r = repos(readyProposal());
  const { FACTS: _skip, ...noFacts } = everyArea;
  assert.equal((await new ApplySetupProposalHandler(r.proposals, r.runs, f.appliers, creator, r.documents, audit, clock, r.ids).handle(ctx, "p1", { project: projectForm, areas: noFacts })).ok, false);

  r = repos(readyProposal());
  const refusing = { handle: async () => ({ ok: false, error: { code: "PLAN_LIMIT_REACHED", message: "limit" } }) };
  const res = await new ApplySetupProposalHandler(r.proposals, r.runs, f.appliers, refusing, r.documents, audit, clock, r.ids).handle(ctx, "p1", { project: projectForm, areas: everyArea });
  assert.equal(res.ok, false);
  assert.deepEqual(f.calls, {});
  assert.equal(r.stored.status, "READY", "a refused project hands the proposal back for review");

  r = repos(readyProposal());
  const stale = { ...r.proposals, update: async () => ok(false) };
  assert.equal((await new ApplySetupProposalHandler(stale, r.runs, f.appliers, creator, r.documents, audit, clock, r.ids).handle(ctx, "p1", { project: projectForm, areas: everyArea })).error.code, "CONFLICT");
});

test("risks and funding already on the project are not created twice", async () => {
  const f = fakes();
  const risks = f.appliers.find((a) => a.area === "RISKS");
  const funding = f.appliers.find((a) => a.area === "FUNDING_BUDGET");
  const c = { auth: ctx, proposalId: "p1" };
  await risks.apply(c, "proj", readyProposal());
  const second = await risks.apply(c, "proj", readyProposal());
  assert.deepEqual([second.value.created, second.value.skipped], [0, 1]);
  await funding.apply(c, "proj", readyProposal());
  const again = await funding.apply(c, "proj", readyProposal());
  assert.deepEqual([again.value.created, again.value.skipped], [0, 1]);
});

test("the source document moves into the new project's own folder, and a failed move never fails the apply", async () => {
  const r = repos(readyProposal());
  const f = fakes();
  const creator = { handle: async () => ok({ id: "proj-9" }) };
  const handler = () => new ApplySetupProposalHandler(r.proposals, r.runs, f.appliers, creator, r.documents, audit, clock, r.ids);
  r.documents.failMoves = true;
  const first = await handler().handle(ctx, "p1", { project: projectForm, areas: everyArea });
  assert.equal(first.ok, true, "the project and its areas are made even when the move fails");
  assert.match(first.value.documents[0].error, /safe in your Google Drive/);
  assert.equal(first.value.documents[0].folder, undefined);
  // The document is still where it was put, and finishing again moves it (the project is not created twice).
  r.documents.failMoves = false;
  await r.proposals.update({ ...r.stored, status: "PARTIAL" });
  const again = await handler().handle(ctx, "p1", { project: projectForm, areas: everyArea });
  assert.equal(again.value.documents[0].folder, "00-Project-Documents");
  assert.equal(again.value.documents[0].link, "https://drive.example/doc");
  assert.deepEqual(r.documents.moves, [{ fileId: "file-1", projectId: "proj-9" }, { fileId: "file-1", projectId: "proj-9" }]);
});

test("a proposal made before documents moved to Drive has nothing to move", async () => {
  const r = repos(readyProposal());
  await r.proposals.update({ ...r.stored, sourceStorageKey: "project-setup/tenant-a/old" });
  const f = fakes();
  const res = await new ApplySetupProposalHandler(r.proposals, r.runs, f.appliers, { handle: async () => ok({ id: "proj-1" }) }, r.documents, audit, clock, r.ids).handle(ctx, "p1", { project: projectForm, areas: everyArea });
  assert.equal(res.ok, true);
  assert.equal(res.value.documents, undefined);
  assert.deepEqual(r.documents.moves, []);
});

test("every document of a set moves into the project's folder, each reported on its own", async () => {
  const r = repos(readyProposal());
  await r.proposals.update({ ...r.stored, sourceStorageKey: "drive:file-1,file-2,file-3" });
  r.documents.moveToProject = async function (_t, fileId, projectId) {
    this.moves.push({ fileId, projectId });
    return fileId === "file-2" ? { ok: false, error: { code: "INVARIANT_VIOLATION", message: "drive down" } } : ok({ name: `${fileId}.docx`, folder: "00-Project-Documents" });
  };
  const f = fakes();
  const res = await new ApplySetupProposalHandler(r.proposals, r.runs, f.appliers, { handle: async () => ok({ id: "proj-3" }) }, r.documents, audit, clock, r.ids).handle(ctx, "p1", { project: projectForm, areas: everyArea });
  assert.equal(res.ok, true, "one file that will not move does not fail the project");
  assert.deepEqual(r.documents.moves.map((m) => m.fileId), ["file-1", "file-2", "file-3"]);
  assert.deepEqual(res.value.documents.map((d) => [d.name === "file-1.docx" || d.name === "file-3.docx" || d.error !== undefined, d.folder ?? null]), [[true, "00-Project-Documents"], [true, null], [true, "00-Project-Documents"]]);
});

test("the wizard's due days are written to the project before any area (periods) is applied, and a failure leaves the setup resumable", async () => {
  const order = [];
  const r = repos(readyProposal());
  const f = fakes();
  const wrapped = f.appliers.map((a) => ({ ...a, apply: async (...args) => { order.push(a.area); return a.apply(...args); } }));
  const writer = { handle: async (_c, projectId, days) => { order.push(`offset:${projectId}:${days}`); return ok({ days }); } };
  const creator = { handle: async () => ok({ id: "proj-1" }) };
  const res = await new ApplySetupProposalHandler(r.proposals, r.runs, wrapped, creator, r.documents, audit, clock, r.ids, writer).handle(ctx, "p1", { project: projectForm, areas: everyArea, deadlineOffsetDays: 15 });
  assert.equal(res.ok, true, res.error?.message);
  assert.equal(order[0], "offset:proj-1:15");

  const r2 = repos(readyProposal());
  const failing = { handle: async () => ({ ok: false, error: { code: "VALIDATION_ERROR", message: "no" } }) };
  const bad = await new ApplySetupProposalHandler(r2.proposals, r2.runs, fakes().appliers, creator, r2.documents, audit, clock, r2.ids, failing).handle(ctx, "p1", { project: projectForm, areas: everyArea, deadlineOffsetDays: 15 });
  assert.equal(bad.ok, false);
  assert.equal(r2.stored.status, "PARTIAL");
  assert.equal(r2.stored.appliedProjectId, "proj-1", "resuming does not create the project twice");
});
