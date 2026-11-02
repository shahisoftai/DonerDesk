// The launch (Phase 38.9b): the server re-checks, creates through the existing apply, runs the wizard's steps in order, and a
// repeat after a failure carries on without doing anything twice. Fakes only: no database, no handlers.
import test from "node:test";
import assert from "node:assert/strict";
import { TenantId, DomainError, signOffDraft, SETUP_REQUIREMENTS, evaluateRequirements, gapInbox } from "@donordesk/domain";
import { LaunchProjectHandler, ReviewModeStep, EntryWindowsStep, FormsStep, InvitationsStep, ActivationStep } from "../dist/index.js";
import { completeDraftForTest } from "./support/pcw-complete-draft.mjs";

const tenantId = TenantId.create("tenant-a");
const NOW = new Date("2026-11-02T08:00:00Z");
const as = (userId, role = "ADMIN") => ({ tenant: { tenantId, userId, role }, requestId: "r" });
const ok = (value) => ({ ok: true, value });
const fail = (message) => ({ ok: false, error: DomainError.validation(message) });
const clock = { now: () => NOW };

// ---------- the steps ----------

test("review mode: simple review is on only when the person chose it; nothing chosen writes nothing", async () => {
  const calls = [];
  const step = new ReviewModeStep({ async handle(_c, p, simple) { calls.push([p, simple]); return ok(undefined); } });
  const d = completeDraftForTest();
  assert.deepEqual((await step.run(as("u1"), "p1", d)).value, { done: 1, notes: [] });
  d.extras.collection.reviewMode = "FULL";
  await step.run(as("u1"), "p1", d);
  delete d.extras.collection.reviewMode;
  assert.deepEqual((await step.run(as("u1"), "p1", d)).value, { done: 0, notes: [] });
  assert.deepEqual(calls, [["p1", true], ["p1", false]]);
  const failing = new ReviewModeStep({ async handle() { return fail("no"); } });
  assert.equal((await failing.run(as("u1"), "p1", completeDraftForTest())).ok, false);
});

test("entry windows: each period gets its window from the rule; a refusing period is named, not fatal", async () => {
  const set = [];
  const writer = {
    async periods() { return ok([{ id: "a", endDate: "2026-03-31T00:00:00.000Z" }, { id: "b", endDate: "2026-06-30T00:00:00.000Z" }]); },
    async setWindow(_c, id, w) { set.push([id, w]); return id === "b" ? fail("This period is closed.") : ok(undefined); },
  };
  const out = await new EntryWindowsStep(writer).run(as("u1"), "p1", completeDraftForTest());
  assert.deepEqual(set[0], ["a", { opensOn: "2026-03-21", closesOn: "2026-04-15" }]);
  assert.equal(out.value.done, 1);
  assert.deepEqual(out.value.notes, ["The period ending 2026-06-30: This period is closed."]);
  const none = await new EntryWindowsStep({ ...writer, async periods() { return ok([]); } }).run(as("u1"), "p1", completeDraftForTest());
  assert.match(none.value.notes[0], /no reporting periods yet/);
  const d = completeDraftForTest(); delete d.extras.collection.windowRule;
  assert.deepEqual((await new EntryWindowsStep(writer).run(as("u1"), "p1", d)).value, { done: 0, notes: [] });
});

test("forms: a draft for each indicator collected by a form; a refusal or a missing indicator is a note", async () => {
  const d = completeDraftForTest();
  d.proposal.indicators.push({ value: { code: "I2", title: "Rate", logframeCode: "OP1", type: "PERCENTAGE", unit: null, baseline: "0", target: "5", targetSchedule: null, frequency: "MONTHLY", direction: null, disaggregation: null, meansOfVerification: null }, sourceQuote: null, sourceRef: null, confidence: "HIGH", status: "EDITED" });
  d.proposal.indicators.push({ ...d.proposal.indicators[0], value: { ...d.proposal.indicators[0].value, code: "I3" } });
  d.extras.indicatorSetup.I2 = { method: "FORM" };
  d.extras.indicatorSetup.I3 = { method: "FORM" };
  const made = [];
  const writer = {
    async indicatorIds() { return ok(new Map([["I1", "id1"], ["I2", "id2"]])); },
    async createDraft(_c, id) { made.push(id); return id === "id2" ? fail("This indicator is a rate, so a form cannot be drafted for it.") : ok({ id: "f", notes: [] }); },
  };
  const out = await new FormsStep(writer).run(as("u1"), "p1", d);
  assert.deepEqual(made, ["id1", "id2"]);
  assert.equal(out.value.done, 1);
  assert.deepEqual(out.value.notes, ["I2: This indicator is a rate, so a form cannot be drafted for it.", "I3: the indicator was not found in the project, so no form was drafted."]);
  const typed = completeDraftForTest(); typed.extras.indicatorSetup.I1 = { method: "MANUAL" };
  assert.deepEqual((await new FormsStep(writer).run(as("u1"), "p1", typed)).value, { done: 0, notes: [] });
});

test("invitations: those marked 'when the project starts', each to this project; waiting invitations and refusals are notes", async () => {
  const d = completeDraftForTest();
  d.extras.team = [
    { key: "a", name: "Ali", email: "Ali@x.org", role: "FIELD_OFFICER", external: false, invite: "NOW" },
    { key: "b", name: "Bo", email: "bo@x.org", role: "VIEWER", external: true, invite: "NOW" },
    { key: "c", name: "Cy", email: "cy@x.org", role: "VIEWER", external: false, invite: "NOW" },
    { key: "d", name: "Di", email: "di@x.org", role: "VIEWER", external: false, invite: "LATER" },
    { key: "e", name: "Ed", email: null, role: "VIEWER", external: false, invite: "NOW" },
  ];
  const sent = [];
  const inviter = {
    async pendingEmails() { return ok(new Set(["bo@x.org"])); },
    async invite(_c, input) { sent.push(input); return input.email === "cy@x.org" ? fail("User already exists") : ok({}); },
  };
  const out = await new InvitationsStep(inviter).run(as("u1"), "p9", d);
  assert.deepEqual(sent, [{ email: "ali@x.org", role: "FIELD_OFFICER", projectIds: ["p9"], external: false }, { email: "cy@x.org", role: "VIEWER", projectIds: ["p9"], external: false }]);
  assert.equal(out.value.done, 1);
  assert.deepEqual(out.value.notes, ["Bo already has an invitation waiting.", "Cy: User already exists"]);
});

test("activation: the project is made active, a refusal stops the launch there, and starting twice is harmless", async () => {
  const calls = [];
  const ok1 = new ActivationStep({ async activate(_c, p) { calls.push(p); return ok(undefined); } });
  assert.deepEqual((await ok1.run(as("u1"), "p1", completeDraftForTest())).value, { done: 1, notes: [] });
  await ok1.run(as("u1"), "p1", completeDraftForTest());
  assert.deepEqual(calls, ["p1", "p1"]);
  const refused = await new ActivationStep({ async activate() { return fail("The project cannot be started."); } }).run(as("u1"), "p1", completeDraftForTest());
  assert.equal(refused.ok, false);
});

// ---------- the launch ----------

function store(initial) {
  let current = { ...initial, updatedAt: NOW };
  return {
    get: () => current,
    async findById() { return ok({ ...current }); },
    async update(p) { current = { ...current, ...p, updatedAt: new Date(current.updatedAt.getTime() + 1000) }; return ok(true); },
  };
}
function runs() {
  const list = [];
  return {
    list,
    async start(r) { list.push({ ...r }); return ok(undefined); },
    async finish(id, _t, detail) { const r = list.find((x) => x.id === id); r.status = "FINISHED"; r.detail = { ...r.detail, ...detail }; return ok(undefined); },
    async fail(id, _t, detail) { const r = list.find((x) => x.id === id); r.status = "FAILED"; r.detail = { ...r.detail, ...detail }; return ok(undefined); },
    async listByProposal() { return ok(list.map((r) => ({ ...r }))); },
  };
}
function launcher({ draft = signed(), status = "READY", steps, applier } = {}) {
  const proposals = store({ id: "pr1", tenantId, createdById: "u1", status, sourceName: "", sourceStorageKey: "", sourceHash: "", sourceLength: 0, proposal: draft.proposal, extras: draft.extras, problems: [], createdAt: NOW, expiresAt: new Date(NOW.getTime() + 86400000) });
  const runLog = runs();
  const applied = [];
  const audit = { events: [], async record(e) { this.events.push(e); } };
  let n = 0;
  const handler = new LaunchProjectHandler(
    proposals, runLog,
    applier ?? { async handle(_c, id, input) { applied.push(input); return ok({ projectId: "proj-1", status: "APPLIED", areas: [{ area: "FACTS", status: "APPLIED", created: 1, skipped: 0, notes: [] }], skipped: [] }); } },
    { async findByTenant() { return ok({ name: "Hope NGO" }); } },
    { async idsByEmail() { return ok(new Map()); } },
    steps ?? [],
    audit, clock, { generate: () => `run-${++n}` },
  );
  return { handler, proposals, runLog, applied, audit };
}
function signed() {
  const d = completeDraftForTest();
  const open = gapInbox(evaluateRequirements(d, SETUP_REQUIREMENTS)).length;
  assert.equal(open, 0);
  return signOffDraft(d, "u1", NOW.toISOString(), 0).draft;
}
const step = (key, behaviour = () => ok({ done: 1, notes: [] })) => { const calls = []; return { key, calls, async run(...a) { calls.push(a[1]); return behaviour(); } }; };
const ALL_KEYS = ["REVIEW_MODE", "ENTRY_WINDOWS", "FORMS", "RESPONSIBILITIES", "BUDGET_LINES", "DASHBOARD", "INVITATIONS", "ACTIVATION"];

test("launch re-checks on the server: not signed off, stale, or something open are all refused before anything is created", async () => {
  const unsigned = completeDraftForTest();
  const a = launcher({ draft: unsigned });
  const r1 = await a.handler.handle(as("u1"), "pr1");
  assert.match(r1.error.message, /Sign off on the last slide/);
  assert.equal(a.applied.length, 0);
  const stale = signed();
  stale.extras.start.donor = "Changed after sign-off";
  const r2 = await launcher({ draft: stale }).handler.handle(as("u1"), "pr1");
  assert.match(r2.error.message, /Something changed after you signed off/);
  const open = signed();
  delete open.extras.dashboardTemplate;
  const r3 = await launcher({ draft: open }).handler.handle(as("u1"), "pr1");
  assert.match(r3.error.message, /1 thing is still to answer/);
});

test("only the person who started it can launch, and only a setup that is ready or partly launched", async () => {
  const x = launcher();
  assert.equal((await x.handler.handle(as("u2", "ADMIN"), "pr1")).error.code, "FORBIDDEN");
  for (const status of ["EXTRACTING", "APPLYING", "APPLIED", "FAILED"]) {
    assert.equal((await launcher({ status }).handler.handle(as("u1"), "pr1")).error.code, "CONFLICT", status);
  }
  assert.equal((await launcher({ status: "PARTIAL" }).handler.handle(as("u1"), "pr1")).ok, true);
});

test("a launch creates the project from the draft through the existing apply, then runs every step in order", async () => {
  const steps = ALL_KEYS.map((k) => step(k));
  const x = launcher({ steps });
  const r = await x.handler.handle(as("u1"), "pr1");
  assert.equal(r.ok, true, r.error?.message);
  assert.equal(r.value.status, "LAUNCHED");
  assert.equal(r.value.projectId, "proj-1");
  assert.equal(x.applied.length, 1);
  assert.deepEqual([x.applied[0].project.title, x.applied[0].project.implementingOrganization, x.applied[0].project.sector, x.applied[0].project.reportingFrequency], ["WASH Gulu", "Hope NGO", "WASH", "QUARTERLY"]);
  assert.equal(x.applied[0].project.projectManagerId, "u1");
  assert.ok(Object.values(x.applied[0].areas).length === 8 && Object.values(x.applied[0].areas).every(Boolean), "every area is applied");
  assert.deepEqual(r.value.steps.map((s) => [s.key, s.status]), ALL_KEYS.map((k) => [k, "DONE"]));
  assert.ok(steps.every((s) => s.calls.length === 1 && s.calls[0] === "proj-1"));
  assert.deepEqual(x.runLog.list.map((l) => [l.kind, l.status, l.detail.step]), ["BEGIN", ...ALL_KEYS].map((k) => ["LAUNCH", "FINISHED", k]));
  assert.equal(x.audit.events.at(-1).eventType, "setup.launch.finished");
});

test("the report says what the draft holds that launching does not write, so nothing is dropped silently", async () => {
  const r = await launcher({ steps: ALL_KEYS.map((k) => step(k)) }).handler.handle(as("u1"), "pr1");
  assert.ok(r.value.notWritten.every((s) => !/checklist|approver|verifier|evidence/i.test(s)), "nothing is listed that the wizard no longer asks for");
  assert.ok(!r.value.notWritten.some((s) => /indicator owner/.test(s)), "owners are written now");
});

test("a step that fails stops the launch there, keeps the earlier steps, and the setup stays open to try again", async () => {
  const steps = [step("REVIEW_MODE"), step("ENTRY_WINDOWS", () => fail("The periods are not ready.")), step("FORMS"), step("RESPONSIBILITIES"), step("BUDGET_LINES"), step("DASHBOARD"), step("INVITATIONS"), step("ACTIVATION")];
  const x = launcher({ steps });
  const r = await x.handler.handle(as("u1"), "pr1");
  assert.equal(r.value.status, "PARTIAL");
  assert.deepEqual(r.value.steps.map((s) => s.status), ["DONE", "FAILED", "NOT_RUN", "NOT_RUN", "NOT_RUN", "NOT_RUN", "NOT_RUN", "NOT_RUN"]);
  assert.equal(r.value.steps[1].error, "The periods are not ready.");
  assert.equal(steps[2].calls.length, 0);
  assert.equal(x.proposals.get().status, "PARTIAL");
  assert.equal(x.audit.events.at(-1).eventType, "setup.launch.partial");
});

test("launching again resumes: finished steps are skipped and only the failed one onward runs", async () => {
  let attempt = 0;
  const steps = [step("REVIEW_MODE"), step("ENTRY_WINDOWS", () => (++attempt === 1 ? fail("not ready") : ok({ done: 3, notes: [] }))), step("FORMS"), step("RESPONSIBILITIES"), step("BUDGET_LINES"), step("DASHBOARD"), step("INVITATIONS"), step("ACTIVATION")];
  const x = launcher({ steps });
  await x.handler.handle(as("u1"), "pr1");
  const again = await x.handler.handle(as("u1"), "pr1");
  assert.equal(again.value.status, "LAUNCHED");
  assert.deepEqual(again.value.steps.map((s) => s.status), ["ALREADY_DONE", "DONE", "DONE", "DONE", "DONE", "DONE", "DONE", "DONE"]);
  assert.equal(steps[0].calls.length, 1, "a finished step is never run twice");
  assert.equal(steps[1].calls.length, 2);
  assert.equal(x.applied.length, 2, "the apply is asked again and itself skips the project and the areas already made");
});

test("when the parts of the project do not all apply, the wizard's steps do not run", async () => {
  const steps = ALL_KEYS.map((k) => step(k));
  const partial = { async handle() { return ok({ projectId: "proj-1", status: "PARTIAL", areas: [{ area: "PLAN", status: "FAILED", created: 0, skipped: 0, notes: [], error: "Folders still being prepared" }], skipped: [] }); } };
  const r = await launcher({ steps, applier: partial }).handler.handle(as("u1"), "pr1");
  assert.equal(r.value.status, "PARTIAL");
  assert.equal(r.value.areas[0].error, "Folders still being prepared");
  assert.ok(steps.every((s) => s.calls.length === 0));
  assert.ok(r.value.steps.every((s) => s.status === "NOT_RUN"));
});

test("an apply that cannot even start is passed on as it is", async () => {
  const refused = { async handle() { return fail("Fix 2 problem(s) in the review before applying."); } };
  const r = await launcher({ steps: [], applier: refused }).handler.handle(as("u1"), "pr1");
  assert.equal(r.ok, false);
  assert.match(r.error.message, /Fix 2 problem/);
});

test("a stale sign-off still blocks the first launch, but not the resume of a project that already exists", async () => {
  const d = signed();
  const fresh = launcher({ draft: d, steps: ALL_KEYS.map((k) => step(k)) });
  // Same content, but the proposal records that the project was already made and was tidied since the sign-off.
  const cur = fresh.proposals.get();
  await fresh.proposals.update({ ...cur, appliedProjectId: "proj-1", status: "PARTIAL", proposal: { ...cur.proposal, logframe: cur.proposal.logframe.map((n) => ({ ...n, value: { ...n.value, linkSource: "SUGGESTED" } })) } });
  const resumed = await fresh.handler.handle(as("u1"), "pr1");
  assert.equal(resumed.ok, true, resumed.error?.message);
  assert.equal(resumed.value.status, "LAUNCHED");
  const first = launcher({ draft: d, steps: [] });
  const edited = first.proposals.get();
  await first.proposals.update({ ...edited, proposal: { ...edited.proposal, logframe: edited.proposal.logframe.map((n) => ({ ...n, value: { ...n.value, linkSource: "SUGGESTED" } })) } });
  assert.match((await first.handler.handle(as("u1"), "pr1")).error.message, /Something changed after you signed off/);
});

test("the apply is handed the person's places folded into the plan, and the stored proposal is left as it was", async () => {
  const d = signed();
  d.proposal.plan[0].value.location = null;
  const x = launcher({ draft: d });
  const before = JSON.stringify(x.proposals.get().proposal);
  await x.handler.handle(as("u1"), "pr1");
  assert.equal(x.applied[0].proposal.plan[0].value.location, "Gulu");
  assert.equal(JSON.stringify(x.proposals.get().proposal), before);
});

test("a first attempt that fails before the project exists can be tried again without signing off again", async () => {
  let attempt = 0;
  const flaky = {
    async handle(_c, _id, input) {
      if (++attempt === 1) { x.proposals.update({ ...x.proposals.get(), proposal: { ...x.proposals.get().proposal, logframe: x.proposals.get().proposal.logframe.map((n) => ({ ...n, value: { ...n.value, linkSource: "SUGGESTED" } })) } }); return fail("Project creation failed."); }
      return ok({ projectId: "proj-1", status: "APPLIED", areas: [], skipped: [] });
    },
  };
  const x = launcher({ steps: ALL_KEYS.map((k) => step(k)), applier: flaky });
  const first = await x.handler.handle(as("u1"), "pr1");
  assert.match(first.error.message, /Project creation failed/);
  assert.deepEqual(x.runLog.list.map((r) => [r.detail.step, r.status]), [["BEGIN", "FAILED"]]);
  const second = await x.handler.handle(as("u1"), "pr1");
  assert.equal(second.ok, true, second.error?.message);
  assert.equal(second.value.status, "LAUNCHED");
});

test("the project is started last, and only when every step before it worked", async () => {
  const order = [];
  const steps = ALL_KEYS.map((k) => ({ key: k, async run() { order.push(k); return k === "INVITATIONS" ? fail("mail is down") : ok({ done: 1, notes: [] }); } }));
  const r = await launcher({ steps }).handler.handle(as("u1"), "pr1");
  assert.equal(r.value.status, "PARTIAL");
  assert.equal(order.at(-1), "INVITATIONS");
  assert.ok(!order.includes("ACTIVATION"), "the project stays a draft, which the product shows as not started yet");
  assert.equal(r.value.steps.at(-1).status, "NOT_RUN");
});
