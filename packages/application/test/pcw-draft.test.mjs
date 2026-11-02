// The wizard's draft handlers with an in-memory proposal store (Phase 38.1): start with no documents, edit decisions, apply a pack.
import test from "node:test";
import assert from "node:assert/strict";
import { TenantId, BUILT_IN_PACKS } from "@donordesk/domain";
import { StartBlankSetupHandler, GetSetupDraftHandler, EditSetupDraftHandler, ApplyDefaultPackHandler, DraftViewer } from "../dist/index.js";

const tenantId = TenantId.create("tenant-a");
const NOW = new Date("2026-11-02T08:00:00Z");
const as = (userId, role = "ADMIN") => ({ tenant: { tenantId, userId, role }, requestId: "r" });
const ok = (value) => ({ ok: true, value });

function store() {
  const byId = new Map();
  let tick = 0;
  const bump = () => new Date(NOW.getTime() + ++tick * 1000);
  return {
    byId,
    async create(p) { byId.set(p.id, { ...p }); return ok(undefined); },
    async findById(id) { const v = byId.get(id); return ok(v ? { ...v } : null); },
    async update(p, expected) {
      const cur = byId.get(p.id);
      if (!cur || (expected && cur.updatedAt.getTime() !== expected.getTime())) return ok(false);
      byId.set(p.id, { ...p, extras: cur.extras, updatedAt: bump() }); // update never writes the decisions
      return ok(true);
    },
    async updateExtras(id, _t, extras, expected) {
      const cur = byId.get(id);
      if (!cur || cur.updatedAt.getTime() !== expected.getTime()) return ok(false);
      byId.set(id, { ...cur, extras, updatedAt: bump() });
      return ok(true);
    },
  };
}
const audits = () => { const events = []; return { events, async record(e) { events.push(e); } }; };
const clock = { now: () => NOW };
const ids = () => { let n = 0; return { generate: () => `draft-${++n}` }; };
const packs = { async list() { return [...BUILT_IN_PACKS]; } };

function setup() {
  const proposals = store();
  const audit = audits();
  const runs = { list: [], async listByProposal(id) { return ok(this.list.filter((r) => r.proposalId === id)); } };
  const viewer = new DraftViewer(runs, clock);
  return {
    proposals, audit, runs, viewer,
    start: new StartBlankSetupHandler(proposals, audit, clock, ids()),
    get: new GetSetupDraftHandler(proposals, clock, viewer),
    edit: new EditSetupDraftHandler(proposals, audit, clock, viewer),
    pack: new ApplyDefaultPackHandler(proposals, packs, audit, clock, viewer),
  };
}

test("a project starts with no documents, empty and ready, with no AI or Drive needed", async () => {
  const s = setup();
  const r = await s.start.handle(as("u1"), { sector: "WASH", country: "Uganda" });
  assert.equal(r.ok, true);
  const stored = s.proposals.byId.get(r.value.proposalId);
  assert.equal(stored.status, "READY");
  assert.equal(stored.sourceStorageKey, "");
  assert.equal(stored.extras.start.withDocuments, false);
  assert.equal(stored.extras.start.sector, "WASH");
  assert.equal(s.audit.events[0].eventType, "setup.blank.started");
});

test("only someone who may create projects can start", async () => {
  const s = setup();
  const r = await s.start.handle(as("u1", "VIEWER"), {});
  assert.equal(r.ok, false);
  assert.equal(r.error.code, "FORBIDDEN");
});

test("reading a draft derives requirements, the inbox and each slide's progress", async () => {
  const s = setup();
  const { value } = await s.start.handle(as("u1"), {});
  const view = (await s.get.handle(as("u1"), value.proposalId)).value;
  assert.equal(view.progress.length, 10);
  assert.ok(view.inbox.length > 0);
  assert.equal(view.progress.find((p) => p.slide === "START").open, 3);
});

test("a draft is private: another person is told it was not found", async () => {
  const s = setup();
  const { value } = await s.start.handle(as("u1"), {});
  const r = await s.get.handle(as("u2", "FIELD_OFFICER"), value.proposalId);
  assert.equal(r.ok, false);
  assert.equal(r.error.code, "NOT_FOUND");
  // An organisation manager may look, as with a document proposal, but only the person who started it may change it.
  assert.equal((await s.get.handle(as("u2", "ADMIN"), value.proposalId)).ok, true);
  const edit = await s.edit.handle(as("u2", "ADMIN"), value.proposalId, { kind: "REOPEN_REQUIREMENT", requirement: "x" });
  assert.equal(edit.ok, false);
  assert.equal(edit.error.code, "FORBIDDEN");
});

test("an edit changes the decisions, re-derives the view and is audited by kind only", async () => {
  const s = setup();
  const { value } = await s.start.handle(as("u1"), {});
  const r = await s.edit.handle(as("u1"), value.proposalId, { kind: "SET_START", patch: { donor: "Any donor", sector: "HEALTH", country: "Kenya" } });
  assert.equal(r.ok, true);
  assert.equal(r.value.progress.find((p) => p.slide === "START").complete, true);
  const event = s.audit.events.at(-1);
  assert.equal(event.eventType, "setup.draft.edited");
  assert.equal(event.newValue, JSON.stringify({ op: "SET_START" }));
});

test("a refused edit says why and saves nothing", async () => {
  const s = setup();
  const { value } = await s.start.handle(as("u1"), {});
  const before = JSON.stringify(s.proposals.byId.get(value.proposalId).extras);
  const r = await s.edit.handle(as("u1"), value.proposalId, { kind: "ANSWER_NOT_USED", requirement: "results.chain" });
  assert.equal(r.ok, false);
  assert.match(r.error.message, /cannot be left out/);
  assert.equal(JSON.stringify(s.proposals.byId.get(value.proposalId).extras), before);
});

test("an edit that loses a race to another save is applied again to what is stored", async () => {
  const s = setup();
  const { value } = await s.start.handle(as("u1"), {});
  const real = s.proposals.updateExtras.bind(s.proposals);
  let lost = false;
  s.proposals.updateExtras = async (...args) => {
    if (!lost) { lost = true; const cur = s.proposals.byId.get(value.proposalId); s.proposals.byId.set(value.proposalId, { ...cur, updatedAt: new Date(NOW.getTime() + 99_000) }); }
    return real(...args);
  };
  const r = await s.edit.handle(as("u1"), value.proposalId, { kind: "SET_START", patch: { donor: "D" } });
  assert.equal(r.ok, true);
  assert.equal(r.value.extras.start.donor, "D");
});

test("a pack fills the draft from its sector, saves the risks and the decisions, and is repeatable", async () => {
  const s = setup();
  const { value } = await s.start.handle(as("u1"), { sector: "WASH" });
  const r = await s.pack.handle(as("u1"), value.proposalId);
  assert.equal(r.ok, true);
  assert.equal(r.value.packLabel, "Water, sanitation and hygiene");
  assert.ok(r.value.filled.includes("Report rules"));
  const stored = s.proposals.byId.get(value.proposalId);
  assert.equal(stored.extras.start.packId, "builtin:wash");
  assert.equal(stored.extras.dashboardTemplate, "tpl-wash-access-hygiene");
  assert.ok(stored.proposal.risks.length >= 2);
  const again = await s.pack.handle(as("u1"), value.proposalId);
  assert.equal(again.ok, true);
  assert.deepEqual(again.value.filled, []);
  assert.equal(s.proposals.byId.get(value.proposalId).proposal.risks.length, stored.proposal.risks.length);
});

test("a pack is refused while documents are still being read", async () => {
  const s = setup();
  const { value } = await s.start.handle(as("u1"), {});
  s.proposals.byId.get(value.proposalId).status = "EXTRACTING";
  const r = await s.pack.handle(as("u1"), value.proposalId);
  assert.equal(r.ok, false);
});

test("the view carries the project's facts, and a typed fact closes its requirement", async () => {
  const { editValue } = await import("@donordesk/domain");
  const s = setup();
  const { value } = await s.start.handle(as("u1"), {});
  const empty = (await s.get.handle(as("u1"), value.proposalId)).value;
  assert.deepEqual(empty.facts, { name: null, code: null, startDate: null, endDate: null, currency: null, summary: null });
  const stored = s.proposals.byId.get(value.proposalId);
  let proposal = stored.proposal;
  for (const [field, v] of [["name", "Wells"], ["code", "W-1"], ["startDate", "2026-01-01"], ["endDate", "2027-01-01"], ["currency", "EUR"]]) {
    proposal = editValue(proposal, { area: "FACTS", path: `facts.${field}` }, v).proposal;
  }
  s.proposals.byId.set(value.proposalId, { ...stored, proposal });
  const view = (await s.get.handle(as("u1"), value.proposalId)).value;
  assert.equal(view.facts.name, "Wells");
  assert.equal(view.results.find((r) => r.key === "project.facts").status, "MET");
});

test("a results change saves the proposal with its version, lists the items in the view and is audited by kind", async () => {
  const { ChangeSetupProposalHandler } = await import("../dist/index.js");
  const { applyResultOperation } = await import("@donordesk/domain");
  const s = setup();
  const change = new ChangeSetupProposalHandler(s.proposals, s.audit, clock, applyResultOperation, "setup.results.changed", s.viewer);
  const { value } = await s.start.handle(as("u1"), {});
  const r = await change.handle(as("u1"), value.proposalId, { kind: "ADD_NODE", level: "GOAL", title: "Healthy families" });
  assert.equal(r.ok, true);
  assert.equal(r.value.logframe.length, 1);
  assert.equal(r.value.logframe[0].origin, "USER");
  assert.equal(r.value.logframe[0].path, "logframe.0");
  assert.equal(s.audit.events.at(-1).newValue, JSON.stringify({ op: "ADD_NODE" }));
  const refused = await change.handle(as("u1"), value.proposalId, { kind: "ADD_NODE", level: "GOAL", title: "Second" });
  assert.equal(refused.ok, false);
  const stranger = await change.handle(as("u2", "ADMIN"), value.proposalId, { kind: "ADD_NODE", level: "OUTCOME", title: "x" });
  assert.equal(stranger.error.code, "FORBIDDEN");
  s.proposals.byId.get(value.proposalId).status = "EXTRACTING";
  assert.equal((await change.handle(as("u1"), value.proposalId, { kind: "ADD_NODE", level: "OUTCOME", title: "x" })).ok, false);
});

test("places use the same change handler: saved with the version, listed in the view, audited by kind", async () => {
  const { ChangeSetupProposalHandler } = await import("../dist/index.js");
  const { applyPlaceOperation } = await import("@donordesk/domain");
  const s = setup();
  const change = new ChangeSetupProposalHandler(s.proposals, s.audit, clock, applyPlaceOperation, "setup.places.changed", s.viewer);
  const { value } = await s.start.handle(as("u1"), {});
  const r = await change.handle(as("u1"), value.proposalId, { kind: "ADD_PLACE", name: "Gulu", adminLevel: 2 });
  assert.equal(r.ok, true);
  assert.deepEqual(r.value.places.map((p) => [p.path, p.origin, p.value.name]), [["places.0", "USER", "Gulu"]]);
  assert.equal(s.audit.events.at(-1).eventType, "setup.places.changed");
  assert.equal((await change.handle(as("u1"), value.proposalId, { kind: "ADD_PLACE", name: "gulu", adminLevel: 2 })).ok, false);
});

test("the plan view carries each row's address, the links offered with reasons, and the coverage", async () => {
  const { ChangeSetupProposalHandler } = await import("../dist/index.js");
  const { applyPlanOperation, applyResultOperation } = await import("@donordesk/domain");
  const s = setup();
  const results = new ChangeSetupProposalHandler(s.proposals, s.audit, clock, applyResultOperation, "setup.results.changed", s.viewer);
  const plan = new ChangeSetupProposalHandler(s.proposals, s.audit, clock, applyPlanOperation, "setup.plan.changed", s.viewer);
  const { value } = await s.start.handle(as("u1"), {});
  const id = value.proposalId;
  const codeOf = (v, title) => v.logframe.find((i) => i.value.title === title).value.code;
  let view = (await results.handle(as("u1"), id, { kind: "ADD_NODE", level: "OUTCOME", title: "Safe water" })).value;
  view = (await results.handle(as("u1"), id, { kind: "ADD_NODE", level: "OUTPUT", title: "Wells built", parentCode: codeOf(view, "Safe water") })).value;
  view = (await results.handle(as("u1"), id, { kind: "ADD_NODE", level: "ACTIVITY", title: "Drill wells", parentCode: codeOf(view, "Wells built") })).value;
  view = (await results.handle(as("u1"), id, { kind: "ADD_INDICATOR", value: { title: "Wells working", logframeCode: codeOf(view, "Wells built") } })).value;
  view = (await plan.handle(as("u1"), id, { kind: "ADD_PLAN", title: "Drill wells", logframeCode: codeOf(view, "Drill wells"), start: "2026-02-01", end: "2026-06-30" })).value;
  assert.equal(view.plan.length, 1);
  assert.equal(view.plan[0].planKey, "new:1");
  assert.deepEqual(view.suggestions.map((x) => [x.kind, x.planKey]), [["INDICATOR", "new:1"]]);
  assert.deepEqual(view.coverage, { activities: { covered: 1, total: 1 }, plans: { complete: 0, total: 1 }, indicators: { fed: 0, total: 1 } });
  const accepted = (await s.edit.handle(as("u1"), id, { kind: "ACCEPT_SUGGESTIONS", ids: view.suggestions.map((x) => x.id) })).value;
  assert.deepEqual(accepted.suggestions, []);
  assert.equal(accepted.extras.planSetup["new:1"].indicatorCodes.length, 1);
  assert.equal(accepted.coverage.indicators.fed, 1);
  assert.deepEqual(accepted.methodSuggestions.map((m) => m.method), ["MANUAL"], "the view offers how to collect it, with a reason");
  assert.match(accepted.methodSuggestions[0].reason, /do not record/);
});

test("sign-off: the server records who and when, refuses an unfinished draft, and goes stale after any change", async () => {
  const { SignOffSetupHandler } = await import("../dist/index.js");
  const { completeDraftForTest } = await import("./support/pcw-complete-draft.mjs");
  const s = setup();
  const sign = new SignOffSetupHandler(s.proposals, s.audit, clock, s.viewer);
  const { value } = await s.start.handle(as("u1"), {});
  const id = value.proposalId;
  const refused = await sign.handle(as("u1"), id);
  assert.equal(refused.ok, false);
  assert.match(refused.error.message, /still to answer/);
  const stored = s.proposals.byId.get(id);
  const done = completeDraftForTest();
  s.proposals.byId.set(id, { ...stored, proposal: done.proposal, extras: done.extras });
  assert.equal((await sign.handle(as("u2", "ADMIN"), id)).error.code, "FORBIDDEN");
  const signed = await sign.handle(as("u1"), id);
  assert.equal(signed.ok, true, signed.error?.message);
  assert.equal(signed.value.extras.signOff.byUserId, "u1", "from the session, not from a request");
  assert.equal(signed.value.extras.signOff.at, NOW.toISOString());
  assert.deepEqual(signed.value.launch, { ok: true, blockers: [] });
  const edited = (await s.edit.handle(as("u1"), id, { kind: "SET_START", patch: { donor: "Changed" } })).value;
  assert.deepEqual(edited.launch.blockers, [{ kind: "SIGN_OFF_STALE" }]);
  assert.equal(s.audit.events.filter((e) => e.eventType === "setup.signed-off").length, 1);
});

test("the view carries the risks, the summary, the launch verdict and the starting dashboards", async () => {
  const s = setup();
  const { value } = await s.start.handle(as("u1"), {});
  const view = (await s.get.handle(as("u1"), value.proposalId)).value;
  assert.deepEqual(view.risks, []);
  assert.equal(view.summary.results, 0);
  assert.equal(view.launch.ok, false);
  assert.ok(view.launch.blockers.some((b) => b.kind === "OPEN_REQUIREMENTS") && view.launch.blockers.some((b) => b.kind === "SIGN_OFF_MISSING"));
  assert.ok(view.dashboardOptions.length >= 3 && view.dashboardOptions.every((d) => d.id && d.title));
});

test("every answer carries where each item was read from, the files, what the reading left out and which parts are being read again", async () => {
  const s = setup();
  const { value } = await s.start.handle(as("u1"), {});
  const id = value.proposalId;
  const stored = s.proposals.byId.get(id);
  const found = { value: { level: "GOAL", code: "G1", title: "Healthy", description: null, parentCode: null }, sourceQuote: "Healthy households", sourceRef: { documentId: "d1", block: 4 }, confidence: "HIGH", status: "PROPOSED" };
  s.proposals.byId.set(id, { ...stored, proposal: { ...stored.proposal, logframe: [found], sources: [{ documentId: "d1", name: "proposal.docx", sheets: [{ title: null, kind: "PROPOSAL" }], feeds: ["LOGFRAME"] }] } });
  const T0 = new Date(NOW.getTime() - 60_000);
  s.runs.list.push(
    { id: "r1", proposalId: id, kind: "EXTRACT", area: "LOGFRAME", status: "FINISHED", detail: { dropped: 2, leftOut: JSON.stringify([{ field: "logframe", text: "Improved health", reason: "QUOTE_NOT_FOUND" }]) }, startedAt: T0 },
    { id: "r2", proposalId: id, kind: "EXTRACT", area: "PLAN", status: "RUNNING", detail: {}, startedAt: new Date(NOW.getTime() - 5_000) },
  );
  const view = (await s.get.handle(as("u1"), id)).value;
  assert.deepEqual(view.logframe[0].source, { documentId: "d1", block: 4 });
  assert.equal(view.sources[0].name, "proposal.docx");
  assert.deepEqual(view.leftOut.map((l) => [l.area, l.total, l.items[0].text]), [["LOGFRAME", 2, "Improved health"]]);
  assert.deepEqual(view.areaRuns, { LOGFRAME: "FINISHED", PLAN: "RUNNING" });
  const afterEdit = (await s.edit.handle(as("u1"), id, { kind: "SET_START", patch: { donor: "D" } })).value;
  assert.deepEqual(afterEdit.areaRuns, view.areaRuns, "an edit\'s answer says the same, so the page never loses it");
  assert.equal((await s.get.handle(as("u1"), id)).value.logframe[0].origin, "DOCUMENT");
  const typed = (await s.start.handle(as("u1"), {})).value.proposalId;
  assert.equal((await s.get.handle(as("u1"), typed)).value.logframe.length, 0);
  assert.deepEqual((await s.get.handle(as("u1"), typed)).value.sources, [], "a draft started with no documents lists no files");
});
