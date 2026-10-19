import test from "node:test";
import assert from "node:assert/strict";
import { TenantId, LogframeItem } from "@donordesk/domain";
import {
  CreatePlannedActivityHandler, ChangePlanStatusHandler, ReschedulePlannedActivityHandler, AssignPlannedActivityHandler,
  UpdatePlannedActivityHandler, PlanAccess, PlanRecorder,
} from "../dist/index.js";

const tenantId = TenantId.create("tenant-a");
const ctxFor = (userId, role) => ({ tenant: { tenantId, userId, role }, requestId: "r" });
const PM = ctxFor("pm", "PROJECT_MANAGER");
const FIELD = ctxFor("fo", "FIELD_OFFICER");
const VIEWER = ctxFor("v", "VIEWER");
const ok = (value) => ({ ok: true, value });

function world({ today = "2026-03-01", reportUses = false } = {}) {
  const store = new Map();
  const revisions = [];
  const audit = [];
  let n = 0;
  const ids = { generate: () => `id${++n}` };
  const clock = { now: () => new Date(`${today}T09:00:00Z`) };
  const repo = {
    create: async (i) => (store.set(i.id, i), ok(i)),
    createMany: async (list) => (list.forEach((i) => store.set(i.id, i)), ok(list)),
    update: async (i) => (store.set(i.id, i), ok(i)),
    findById: async (id) => ok(store.get(id) ?? null),
    findByProject: async (p) => ok([...store.values()].filter((i) => i.projectId === p)),
    findBySeries: async (s) => ok([...store.values()].filter((i) => i.seriesId === s)),
  };
  const context = {
    activeMemberIds: async () => ok(new Set(["pm", "fo", "me"])),
    reportUsesDates: async () => ok(reportUses),
    projectDates: async () => ok({ start: "2026-01-01", end: "2026-12-31" }),
  };
  const node = (id, level, parentId) => LogframeItem.create({ id, tenantId: "tenant-a", projectId: "p", level, parentId, code: id, title: id });
  const logframe = { findByProject: async () => ok([node("out", "OUTPUT"), node("act", "ACTIVITY", "out")]) };
  const auditLogger = { record: async (e) => void audit.push(e) };
  const recorder = new PlanRecorder(ids, { append: async (r) => (revisions.push(r), ok(undefined)) }, auditLogger, clock);
  const access = new PlanAccess(repo);
  return {
    store, revisions, audit,
    create: new CreatePlannedActivityHandler(ids, repo, context, logframe, auditLogger),
    status: new ChangePlanStatusHandler(access, repo, recorder, clock),
    move: new ReschedulePlannedActivityHandler(access, repo, context, recorder, clock),
    assign: new AssignPlannedActivityHandler(access, repo, context, recorder),
    update: new UpdatePlannedActivityHandler(access, repo, context, recorder, clock),
  };
}
const input = (extra = {}) => ({ title: "Outreach", plannedStart: "2026-03-10", plannedEnd: "2026-03-12", supportUserIds: [], ...extra });

test("creating needs workplan.manage, derives the output from the logframe node, and is audited", async () => {
  const w = world();
  assert.equal((await w.create.handle(FIELD, "p", input())).error.code, "FORBIDDEN");
  assert.equal((await w.create.handle(VIEWER, "p", input())).ok, false);
  const out = await w.create.handle(PM, "p", input({ logframeActivityId: "act", ownerUserId: "fo" }));
  assert.equal(out.ok, true);
  assert.equal(w.store.get(out.value.ids[0]).snapshot().outputId, "out");
  assert.equal(w.audit[0].eventType, "workplan.item_created");
  assert.equal((await w.create.handle(PM, "p", input({ logframeActivityId: "out" }))).ok, false, "only an ACTIVITY node");
  assert.equal((await w.create.handle(PM, "p", input({ ownerUserId: "stranger" }))).ok, false, "only active members lead");
});

test("a monthly repeat creates one row per month in one call, sharing a series", async () => {
  const w = world();
  const out = await w.create.handle(PM, "p", input({ plannedEnd: "2026-03-10", repeats: { every: "MONTH", until: "2026-06-30" } }));
  assert.equal(out.value.ids.length, 4);
  assert.equal(new Set(out.value.ids.map((id) => w.store.get(id).seriesId)).size, 1);
  assert.equal((await w.create.handle(PM, "p", input({ repeats: { every: "MONTH", until: "2026-01-01" } }))).ok, false);
});

test("a lead may change the status of their own activity, but not someone else's, and cancel needs a manager and a reason", async () => {
  const w = world();
  const [mine] = (await w.create.handle(PM, "p", input({ ownerUserId: "fo" }))).value.ids;
  const [other] = (await w.create.handle(PM, "p", input({ ownerUserId: "me" }))).value.ids;
  assert.equal((await w.status.handle(FIELD, mine, { action: "START" })).ok, true);
  assert.equal((await w.status.handle(FIELD, other, { action: "START" })).error.code, "FORBIDDEN");
  assert.equal((await w.status.handle(FIELD, mine, { action: "CANCEL", reason: "x" })).error.code, "FORBIDDEN");
  assert.equal((await w.status.handle(PM, mine, { action: "CANCEL" })).ok, false);
  assert.equal((await w.status.handle(PM, mine, { action: "CANCEL", reason: "Funding cut" })).ok, true);
  assert.equal((await w.status.handle(PM, "missing", { action: "START" })).error.code, "NOT_FOUND");
  assert.deepEqual(w.revisions.map((r) => r.change.status.to), ["IN_PROGRESS", "CANCELLED"]);
  assert.equal(w.revisions[1].reason, "Funding cut");
  assert.deepEqual(w.audit.filter((a) => a.eventType === "workplan.status_changed").length, 2);
});

test("rescheduling asks why only when the original dates have passed or a report uses it; every move is a revision", async () => {
  const early = world({ today: "2026-03-01" });
  const [id] = (await early.create.handle(PM, "p", input())).value.ids;
  assert.equal((await early.move.handle(FIELD, id, { plannedStart: "2026-03-11", plannedEnd: "2026-03-13", scope: "THIS" })).error.code, "FORBIDDEN");
  assert.equal((await early.move.handle(PM, id, { plannedStart: "2026-03-11", plannedEnd: "2026-03-13", scope: "THIS" })).ok, true);
  assert.equal(early.revisions.length, 1);
  assert.equal(early.store.get(id).originalStart, "2026-03-10");

  const late = world({ today: "2026-04-01" });
  const [l] = (await late.create.handle(PM, "p", input())).value.ids;
  const refused = await late.move.handle(PM, l, { plannedStart: "2026-04-10", plannedEnd: "2026-04-12", scope: "THIS" });
  assert.equal(refused.error.details.field, "reason");
  assert.equal(late.revisions.length, 0, "nothing stored on refusal");
  assert.equal((await late.move.handle(PM, l, { plannedStart: "2026-04-10", plannedEnd: "2026-04-12", scope: "THIS", reason: "Floods" })).ok, true);

  const used = world({ reportUses: true });
  const [u] = (await used.create.handle(PM, "p", input())).value.ids;
  assert.equal((await used.move.handle(PM, u, { plannedStart: "2026-03-11", plannedEnd: "2026-03-13", scope: "THIS" })).ok, false);
});

test("moving 'this and later ones' shifts the rest of the series by the same distance", async () => {
  const w = world();
  const ids = (await w.create.handle(PM, "p", input({ plannedEnd: "2026-03-10", repeats: { every: "MONTH", until: "2026-05-31" } }))).value.ids;
  const out = await w.move.handle(PM, ids[1], { plannedStart: "2026-04-12", plannedEnd: "2026-04-12", scope: "SERIES_FROM_HERE" });
  assert.equal(out.value.moved, 2);
  assert.equal(w.store.get(ids[0]).plannedStart, "2026-03-10", "earlier one untouched");
  assert.equal(w.store.get(ids[1]).plannedStart, "2026-04-12");
  assert.equal(w.store.get(ids[2]).plannedStart, "2026-05-12");
});

test("assigning checks membership, is idempotent, and records only real changes", async () => {
  const w = world();
  const [id] = (await w.create.handle(PM, "p", input())).value.ids;
  assert.equal((await w.assign.handle(FIELD, id, { ownerUserId: "fo", supportUserIds: [] })).error.code, "FORBIDDEN");
  assert.equal((await w.assign.handle(PM, id, { ownerUserId: "stranger", supportUserIds: [] })).ok, false);
  assert.equal((await w.assign.handle(PM, id, { ownerUserId: "fo", supportUserIds: ["me"] })).ok, true);
  assert.equal((await w.assign.handle(PM, id, { ownerUserId: "fo", supportUserIds: ["me"] })).ok, true);
  assert.equal(w.revisions.length, 1);
  assert.equal((await w.assign.handle(PM, id, { ownerUserId: null, supportUserIds: [] })).ok, true);
  assert.equal(w.store.get(id).ownerUserId, undefined);
});

test("a lead may edit notes and location, but not the title or targets", async () => {
  const w = world();
  const [id] = (await w.create.handle(PM, "p", input({ ownerUserId: "fo", location: "Ward 4" }))).value.ids;
  assert.equal((await w.update.handle(FIELD, id, { description: "Door to door" })).ok, true);
  assert.equal((await w.update.handle(FIELD, id, { location: null })).ok, true);
  assert.equal(w.store.get(id).snapshot().location, undefined);
  assert.equal((await w.update.handle(FIELD, id, { title: "Renamed" })).error.code, "FORBIDDEN");
  assert.equal((await w.update.handle(PM, id, { title: "Renamed" })).ok, true);
  assert.equal(w.store.get(id).title, "Renamed");
});

import { StartPlanFromLogframeHandler, ListWorkPlanHandler, PlanLinkResolver, CreateActivityUpdateHandler } from "../dist/index.js";

function wizard(opts) {
  const w = world(opts);
  const nodes = [LogframeItem.create({ id: "out", tenantId: "tenant-a", projectId: "p", level: "OUTPUT", code: "out", title: "Output one" }),
    ...["a1", "a2", "a3"].map((id) => LogframeItem.create({ id, tenantId: "tenant-a", projectId: "p", level: "ACTIVITY", parentId: "out", code: id, title: `Activity ${id}` }))];
  const repo = { createMany: async (l) => (l.forEach((i) => w.store.set(i.id, i)), ok(l)), findByProject: async (p) => ok([...w.store.values()].filter((i) => i.projectId === p)) };
  let n = 100;
  const handler = new StartPlanFromLogframeHandler({ generate: () => `w${++n}` }, repo,
    { activeMemberIds: async () => ok(new Set(["pm", "fo"])), reportUsesDates: async () => ok(false), projectDates: async (p) => ok(p === "p" ? { start: "2026-01-01", end: "2026-12-31" } : null) },
    { findByProject: async () => ok(nodes) }, { record: async (e) => void w.audit.push(e) });
  return { w, handler };
}

test("the wizard previews without saving, then creates the whole plan once, audited", async () => {
  const { w, handler } = wizard();
  const rows = [{ logframeActivityId: "a1", monthly: false }, { logframeActivityId: "a2", monthly: true, ownerUserId: "fo" }, { logframeActivityId: "a3", monthly: false }];
  const preview = await handler.handle(PM, "p", { apply: false, rows });
  assert.equal(preview.value.preview.repeating, 1);
  assert.equal(preview.value.preview.total, 14, "2 single + 12 monthly");
  assert.equal(w.store.size, 0, "preview saves nothing");
  const applied = await handler.handle(PM, "p", { apply: true, rows });
  assert.equal(applied.value.createdIds.length, 14);
  assert.equal(w.audit.at(-1).eventType, "workplan.started_from_logframe");
  assert.equal((await handler.handle(PM, "p", { apply: true, rows })).error.code, "CONFLICT", "never twice");
});

test("the wizard defaults to every logframe activity, refuses non-members, other roles and unknown nodes", async () => {
  const { handler } = wizard();
  assert.equal((await handler.handle(PM, "p", { apply: false })).value.preview.total, 3);
  assert.equal((await handler.handle(FIELD, "p", { apply: false })).error.code, "FORBIDDEN");
  assert.equal((await handler.handle(PM, "p", { apply: false, rows: [{ logframeActivityId: "nope", monthly: false }] })).ok, false);
  assert.equal((await handler.handle(PM, "p", { apply: false, rows: [{ logframeActivityId: "a1", monthly: false, ownerUserId: "x" }] })).ok, false);
  assert.equal((await handler.handle(PM, "missing", { apply: false })).error.code, "NOT_FOUND");
});

test("the list derives the signal and suggestion from completed activities, and filters", async () => {
  const w = world({ today: "2026-03-20" });
  const [a, b] = [
    (await w.create.handle(PM, "p", input({ title: "A", ownerUserId: "fo", plannedStart: "2026-03-01", plannedEnd: "2026-03-05" }))).value.ids[0],
    (await w.create.handle(PM, "p", input({ title: "B", plannedStart: "2026-04-20", plannedEnd: "2026-04-21" }))).value.ids[0],
  ];
  const repo = { findByProject: async (p) => ok([...w.store.values()].filter((i) => i.projectId === p)) };
  const facts = { factsByPlannedActivity: async () => ok(new Map([[a, { liveRecords: 1, acceptedRecords: 0, deliveredCount: 1 }]])) };
  const list = new ListWorkPlanHandler(repo, facts, { reportCoveredRanges: async () => ok([{ start: "2026-04-01", end: "2026-04-30" }]) }, { now: () => new Date("2026-03-20T09:00:00Z") });
  const all = (await list.handle(PM, "p")).value;
  assert.deepEqual(all.map((r) => [r.title, r.signal, r.signalLabel]), [["A", "LATE", "Late"], ["B", "ON_TIME", "On time"]]);
  assert.equal(all[0].signalReason, "past its end date 5 Mar");
  assert.equal(all[0].suggestedStatus, "IN_PROGRESS");
  assert.deepEqual(all.map((r) => r.reasonRequired), [true, true], "A's original end passed; B is inside a period that has a report");
  assert.equal((await list.handle(PM, "p", { ownerId: "fo" })).value.length, 1);
  assert.equal((await list.handle(PM, "p", { from: "2026-04-01" })).value[0].id, b);
});

test("a completed activity may name a planned activity: it fills the logframe link, and other projects are refused", async () => {
  const w = world();
  const [id] = (await w.create.handle(PM, "p", input({ logframeActivityId: "act" }))).value.ids;
  const resolver = new PlanLinkResolver({ findById: async (i) => ok(w.store.get(i) ?? null) });
  assert.deepEqual((await resolver.resolve(PM, "p", { plannedActivityId: id })).value, { plannedActivityId: id, logframeActivityId: "act" });
  assert.equal((await resolver.resolve(PM, "other", { plannedActivityId: id })).error.details.field, "plannedActivityId");
  assert.equal((await resolver.resolve(PM, "p", { plannedActivityId: id, logframeActivityId: "zzz" })).ok, false);
  assert.deepEqual((await resolver.resolve(PM, "p", {})).value, {}, "no link, no lookup");

  const created = [];
  const handler = new CreateActivityUpdateHandler({ generate: () => "act1" }, { create: async (a) => (created.push(a), ok(a)) }, { record: async () => {} }, undefined, resolver);
  const out = await handler.handle(PM, { projectId: "p", reportingPeriodId: "rp", activityTitle: "Visit", activityDate: "2026-03-10T00:00:00.000Z", summary: "Held.", achievements: "", challenges: "", lessonsLearned: "", nextSteps: "", attachedEvidenceIds: [], plannedActivityId: id });
  assert.equal(out.ok, true);
  assert.equal(created[0].plannedActivityId, id);
  assert.equal(created[0].logframeActivityId, "act");
});

import { ListPlanRevisionsHandler } from "../dist/index.js";
test("the history lists a planned activity's changes with their reasons, and 404s across tenants", async () => {
  const w = world({ today: "2026-04-01" });
  const [id] = (await w.create.handle(PM, "p", input())).value.ids;
  await w.move.handle(PM, id, { plannedStart: "2026-04-10", plannedEnd: "2026-04-12", scope: "THIS", reason: "Floods" });
  const handler = new ListPlanRevisionsHandler({ findById: async (i) => ok(w.store.get(i) ?? null) }, { findByPlannedActivity: async (i) => ok(w.revisions.filter((r) => r.plannedActivityId === i)) });
  const out = await handler.handle(FIELD, id);
  assert.equal(out.value.length, 1);
  assert.equal(out.value[0].reason, "Floods");
  assert.deepEqual(out.value[0].changes.plannedEnd, { from: "2026-03-12", to: "2026-04-12" });
  assert.equal((await handler.handle(FIELD, "nope")).error.code, "NOT_FOUND");
});

import { ImportWorkPlanHandler, CopyWorkPlanHandler, SetWorkPlanningVisibilityHandler, ListProjectPeopleHandler } from "../dist/index.js";
import { Project, DateRange } from "@donordesk/domain";

const node = (id, level, code, parentId, projectId = "p") => LogframeItem.create({ id, tenantId: "tenant-a", projectId, level, parentId, code, title: `${code} title` });

function importWorld() {
  const w = world();
  const nodes = [node("out", "OUTPUT", "O1"), node("act", "ACTIVITY", "A1.1", "out")];
  const handler = new ImportWorkPlanHandler(
    { generate: (() => { let n = 500; return () => `i${++n}`; })() },
    { createMany: async (l) => (l.forEach((i) => w.store.set(i.id, i)), ok(l)), findByProject: async (p) => ok([...w.store.values()].filter((i) => i.projectId === p)) },
    { projectDates: async () => ok({ start: "2026-01-01", end: "2026-06-30" }) },
    { activeUserIdsByEmail: async () => ok(new Map([["amina@org.org", "fo"]])) },
    { findByProject: async () => ok(nodes) },
    { record: async (e) => void w.audit.push(e) },
  );
  return { w, handler };
}
const HEAD = "Logframe Code,Title,Start,End,Lead email,Location,Sessions,Repeats\n";

test("import previews without saving, then creates; codes and leads are resolved", async () => {
  const { w, handler } = importWorld();
  const text = `${HEAD}A1.1,Outreach,2026-03-10,2026-03-12,amina@org.org,Ward 4,4,\nO1,Training,2026-04-01,,,,,\n`;
  const preview = await handler.handle(PM, "p", { apply: false, text });
  assert.equal(preview.value.applied, false);
  assert.equal(preview.value.items.length, 2);
  assert.equal(w.store.size, 0);
  const done = await handler.handle(PM, "p", { apply: true, text, sourceName: "plan.xlsx" });
  assert.equal(done.value.created, 2);
  const outreach = [...w.store.values()].find((i) => i.title === "Outreach").snapshot();
  assert.deepEqual([outreach.logframeActivityId, outreach.outputId, outreach.ownerUserId, outreach.targetCount], ["act", "out", "fo", 4]);
  assert.equal([...w.store.values()].find((i) => i.title === "Training").snapshot().outputId, "out", "an output code links the output only");
  assert.equal(w.audit.at(-1).eventType, "workplan.imported");
});

test("one bad row blocks the whole import and names it; a re-import skips what exists", async () => {
  const { w, handler } = importWorld();
  const text = `${HEAD}A1.1,Good,2026-03-10,2026-03-12,,,,\nZ9,Bad code,2026-03-10,,,,,\nA1.1,Bad lead,2026-03-10,,nobody@org.org,,,\n`;
  const refused = await handler.handle(PM, "p", { apply: true, text });
  assert.equal(refused.ok, false);
  assert.match(refused.error.message, /Nothing was imported: 2 rows need fixing\. Row 2: no logframe item has the code Z9\. Row 3: nobody@org\.org is not an active member/);
  assert.equal(w.store.size, 0);
  const previewed = await handler.handle(PM, "p", { apply: false, text });
  assert.equal(previewed.value.problems.length, 2, "a preview lists the problems instead of failing");

  const good = `${HEAD}A1.1,Good,2026-03-10,2026-03-12,,,,\n`;
  assert.equal((await handler.handle(PM, "p", { apply: true, text: good })).value.created, 1);
  const again = await handler.handle(PM, "p", { apply: true, text: good });
  assert.deepEqual([again.value.created, again.value.skipped], [0, 1]);
  assert.equal((await handler.handle(FIELD, "p", { apply: true, text: good })).error.code, "FORBIDDEN");
});

test("a repeating row expands to the project end", async () => {
  const { handler } = importWorld();
  const out = await handler.handle(PM, "p", { apply: true, text: `${HEAD}A1.1,Clinic,2026-01-05,2026-01-06,,,,Monthly\n` });
  assert.equal(out.value.created, 6);
});

function copyWorld({ targetPlan = [] } = {}) {
  const w = world();
  const proj = (id, start, end) => Project.rehydrate({ id, tenantId: tenantId, createdAt: new Date(), props: { title: id, projectCode: id, donorName: "d", implementingOrganization: "o", country: "c", sector: "HEALTH", duration: DateRange.create(new Date(start), new Date(end)), reportingFrequency: "QUARTERLY", status: "ACTIVE", isDemo: false } });
  const projects = { findById: async (id) => ok(id === "src" ? proj("src", "2026-01-01", "2026-12-31") : id === "dst" ? proj("dst", "2027-01-01", "2027-12-31") : null) };
  const mk = (projectId, extra) => PlannedActivity_create(projectId, extra);
  const logframe = { findByProject: async (p) => ok([node(`${p}-act`, "ACTIVITY", "A1", undefined, p)]) };
  const created = [];
  const plans = { findByProject: async (p) => ok(p === "src" ? [mk("src", { id: "s1", title: "Visits", plannedStart: "2026-01-10", plannedEnd: "2026-01-12", logframeActivityId: "src-act", people: { ownerUserId: "fo", supportUserIds: [] } })] : targetPlan), createMany: async (l) => (created.push(...l), ok(l)) };
  return { created, w, handler: new CopyWorkPlanHandler(projects, logframe, plans, { generate: (() => { let n = 700; return () => `c${++n}`; })() }, { record: async (e) => void w.audit.push(e) }) };
}
import { PlannedActivity as PA } from "@donordesk/domain";
function PlannedActivity_create(projectId, o) { return PA.create({ tenantId: "tenant-a", projectId, createdById: "u", ...o }).value; }

test("copying a work plan maps logframe activities by code, shifts dates, and never copies leads", async () => {
  const { handler, created, w } = copyWorld();
  const out = await handler.handle(PM, { sourceProjectId: "src", targetProjectId: "dst" });
  assert.equal(out.value.plannedActivities, 1);
  const s = created[0].snapshot();
  assert.deepEqual([s.plannedStart, s.plannedEnd, s.logframeActivityId, s.ownerUserId, s.status], ["2027-01-10", "2027-01-12", "dst-act", undefined, "PLANNED"]);
  assert.equal(w.audit.at(-1).eventType, "workplan.copied");
  assert.equal((await handler.handle(FIELD, { sourceProjectId: "src", targetProjectId: "dst" })).error.code, "FORBIDDEN");
  assert.equal((await handler.handle(PM, { sourceProjectId: "src", targetProjectId: "nope" })).error.code, "NOT_FOUND");
  const filled = copyWorld({ targetPlan: [PlannedActivity_create("dst", { id: "x", title: "Existing", plannedStart: "2027-02-01", plannedEnd: "2027-02-02" })] });
  assert.equal((await filled.handler.handle(PM, { sourceProjectId: "src", targetProjectId: "dst" })).ok, false, "never into a project that already has a plan");
});

test("only an admin shows or hides work planning, and the change is audited once", async () => {
  const audit = [];
  const project = { showWorkPlanning: true, setWorkPlanningVisible(v) { this.showWorkPlanning = v; } };
  const handler = new SetWorkPlanningVisibilityHandler({ findById: async (id) => ok(id === "p" ? project : null), update: async (p) => ok(p) }, { record: async (e) => void audit.push(e) });
  const ADMIN = ctxFor("ad", "ADMIN");
  assert.equal((await handler.handle(PM, "p", false)).error.code, "FORBIDDEN");
  assert.equal((await handler.handle(ADMIN, "p", false)).ok, true);
  assert.equal(project.showWorkPlanning, false);
  assert.equal((await handler.handle(ADMIN, "p", false)).ok, true);
  assert.equal(audit.length, 1, "no change, no audit event");
  assert.equal((await handler.handle(ADMIN, "missing", true)).error.code, "NOT_FOUND");
});

test("project people lists active members with names only, sorted", async () => {
  const handler = new ListProjectPeopleHandler(
    { findByProject: async () => ok([{ userId: "u2", role: "FIELD_OFFICER", status: "ACTIVE" }, { userId: "u1", role: "PROJECT_MANAGER", status: "ACTIVE" }, { userId: "u3", role: "VIEWER", status: "REMOVED" }]) },
    { listByTenant: async () => ok([{ id: { toString: () => "u1" }, name: "Zed" }, { id: { toString: () => "u2" }, name: "Amina" }, { id: { toString: () => "u3" }, name: "Gone" }]) },
  );
  const out = await handler.handle(VIEWER, "p");
  assert.deepEqual(out.value, [{ userId: "u2", name: "Amina", role: "FIELD_OFFICER" }, { userId: "u1", name: "Zed", role: "PROJECT_MANAGER" }]);
  assert.ok(out.value.every((p) => !("email" in p)));
});

import { GetMyWeekHandler } from "../dist/index.js";
test("my week is always the caller's own: late, this week and next week, with what was sent back", async () => {
  const w = world({ today: "2026-03-11" });
  const mk = async (title, start, end, owner) => (await w.create.handle(PM, "p", input({ title, plannedStart: start, plannedEnd: end, ownerUserId: owner }))).value.ids[0];
  const late = await mk("Late one", "2026-02-20", "2026-02-25", "fo");
  const here = await mk("This week", "2026-03-12", "2026-03-13", "fo");
  await mk("Not mine", "2026-03-12", "2026-03-13", "me");
  const asked = [];
  const reader = {
    openPlannedFor: async (userId, _t, before) => (asked.push([userId, before]), ok([...w.store.values()].filter((i) => i.ownerUserId === userId && i.plannedStart <= before && i.status !== "DONE").map((item) => ({ item, projectTitle: "Clinics" })))),
    sentBackFor: async (userId) => ok(userId === "fo" ? [{ id: "a1", projectId: "p", projectTitle: "Clinics", title: "Visit", activityDate: "2026-03-02", status: "NEEDS_REVISION" }] : []),
  };
  const facts = { factsByPlannedActivity: async () => ok(new Map([[here, { liveRecords: 1, acceptedRecords: 0, deliveredCount: 0 }]])) };
  const handler = new GetMyWeekHandler(reader, facts, { now: () => new Date("2026-03-11T09:00:00Z") });
  const out = (await handler.handle(FIELD)).value;
  assert.deepEqual(asked, [["fo", "2026-03-22"]], "this Monday + 13 days, for the caller only");
  assert.equal(out.weekStart, "2026-03-09");
  assert.deepEqual(out.planned.map((p) => [p.title, p.signal, p.projectTitle]), [["Late one", "LATE", "Clinics"], ["This week", "ON_TIME", "Clinics"]]);
  assert.equal(out.planned[0].id, late);
  assert.ok(out.planned.every((p) => !("reasonRequired" in p)));
  assert.equal(out.sentBack.length, 1);
  assert.equal((await handler.handle(ctxFor("someone-else", "FIELD_OFFICER"))).value.sentBack.length, 0);
});

import { GetActivityFileNeedsHandler } from "../dist/index.js";
test("files we will need: set when planning, changed with the same history entry, and a bad kind is refused", async () => {
  const w = world();
  const bad = await w.create.handle(PM, "p", input({ requiredFiles: ["SELFIE"] }));
  assert.equal(bad.error.details.field, "requiredFiles");
  const [id] = (await w.create.handle(PM, "p", input({ requiredFiles: ["ATTENDANCE_SHEET"] }))).value.ids;
  assert.deepEqual(w.store.get(id).requiredFiles, ["ATTENDANCE_SHEET"]);
  assert.equal((await w.update.handle(FIELD, id, { requiredFiles: ["PHOTO"] })).error.code, "FORBIDDEN", "a lead changes notes, not what is asked of the team");
  const before = w.revisions.length;
  assert.equal((await w.update.handle(PM, id, { requiredFiles: ["ATTENDANCE_SHEET", "PHOTO"], location: "Ward 4" })).ok, true);
  assert.equal(w.revisions.length, before + 1, "one history entry for one edit");
  assert.deepEqual(Object.keys(w.revisions.at(-1).change).sort(), ["location", "requiredFiles"]);
  assert.equal((await w.update.handle(PM, id, { requiredFiles: ["ATTENDANCE_SHEET", "PHOTO"] })).ok, true);
  assert.equal(w.revisions.length, before + 1, "no change, no entry");
  assert.equal((await w.update.handle(PM, id, { requiredFiles: ["OTHER"] })).ok, false);
});

test("the plan list says which kinds of file no completed activity has shown yet", async () => {
  const w = world({ today: "2026-03-20" });
  const [id] = (await w.create.handle(PM, "p", input({ requiredFiles: ["ATTENDANCE_SHEET", "PHOTO"] }))).value.ids;
  const repo = { findByProject: async (p) => ok([...w.store.values()].filter((i) => i.projectId === p)) };
  const context = { reportCoveredRanges: async () => ok([]) };
  const list = (facts) => new ListWorkPlanHandler(repo, { factsByPlannedActivity: async () => ok(new Map(facts ? [[id, facts]] : [])) }, context, { now: () => new Date("2026-03-20T09:00:00Z") });
  const none = (await list(null).handle(PM, "p")).value[0];
  assert.deepEqual([none.requiredFiles, none.stillNeeded], [["ATTENDANCE_SHEET", "PHOTO"], []], "nothing is 'missing' before there is a completed activity");
  const some = (await list({ liveRecords: 1, acceptedRecords: 0, deliveredCount: 0, evidenceTypes: ["PHOTO"] }).handle(PM, "p")).value[0];
  assert.deepEqual(some.stillNeeded, ["ATTENDANCE_SHEET"]);
  const all = (await list({ liveRecords: 2, acceptedRecords: 0, deliveredCount: 0, evidenceTypes: ["PHOTO", "ATTENDANCE_SHEET"] }).handle(PM, "p")).value[0];
  assert.deepEqual(all.stillNeeded, []);
});

test("for one completed activity: what its planned activity asks for and this one lacks; nothing when unlinked", async () => {
  const w = world();
  const [planId] = (await w.create.handle(PM, "p", input({ requiredFiles: ["ATTENDANCE_SHEET", "PHOTO"] }))).value.ids;
  const acts = new Map([["a1", { plannedActivityId: planId, attachedEvidenceIds: ["e1"] }], ["a2", { attachedEvidenceIds: [] }], ["a3", { plannedActivityId: planId, attachedEvidenceIds: [] }]]);
  const handler = new GetActivityFileNeedsHandler(
    { findById: async (id) => ok(acts.get(id) ?? null) }, { findById: async (id) => ok(w.store.get(id) ?? null) }, { findById: async (id) => ok(id === "e1" ? { evidenceType: "PHOTO" } : null) },
  );
  assert.deepEqual((await handler.handle(FIELD, "a1")).value, { required: ["ATTENDANCE_SHEET", "PHOTO"], provided: ["PHOTO"], stillNeeded: ["ATTENDANCE_SHEET"] });
  assert.deepEqual((await handler.handle(FIELD, "a2")).value, { required: [], provided: [], stillNeeded: [] }, "not linked to a plan");
  assert.deepEqual((await handler.handle(FIELD, "a3")).value.stillNeeded, ["ATTENDANCE_SHEET", "PHOTO"]);
  assert.equal((await handler.handle(FIELD, "nope")).error.code, "NOT_FOUND");
});

test("a lead change for a series applies from this activity onward; earlier and finished ones are left alone", async () => {
  const w = world();
  const first = (await w.create.handle(PM, "p", input({ plannedEnd: "2026-03-10", repeats: { every: "MONTH", until: "2026-06-30" }, ownerUserId: "fo" }))).value.ids;
  const second = first[1];
  assert.equal((await w.assign.handle(PM, second, { ownerUserId: "me", supportUserIds: [], scope: "SERIES_FROM_HERE" })).ok, true);
  assert.equal(w.store.get(first[0]).ownerUserId, "fo", "earlier one unchanged");
  assert.equal(w.store.get(second).ownerUserId, "me");
  assert.equal(w.store.get(first[3]).ownerUserId, "me", "later one changed");
});

test("the logframe link can be moved to another activity of the project, the output follows, and a bad node is refused", async () => {
  const w = world();
  const node = (id, level, parentId) => LogframeItem.create({ id, tenantId: "tenant-a", projectId: "p", level, parentId, code: id, title: id });
  const nodes = [node("out1", "OUTPUT"), node("out2", "OUTPUT"), node("actA", "ACTIVITY", "out1"), node("actB", "ACTIVITY", "out2")];
  const facts = (records) => ({ factsByPlannedActivity: async () => ok(new Map(records)) });
  const repo = { findById: async (id) => ok(w.store.get(id) ?? null), update: async (i) => (w.store.set(i.id, i), ok(i)) };
  const make = (f) => new UpdatePlannedActivityHandler(new PlanAccess(repo), repo, { reportUsesDates: async () => ok(false), activeMemberIds: async () => ok(new Set(["pm"])) },
    new PlanRecorder({ generate: () => "r" }, { append: async () => ok(undefined) }, { record: async () => undefined }, { now: () => new Date("2026-03-01T09:00:00Z") }),
    { now: () => new Date("2026-03-01T09:00:00Z") }, { findByProject: async () => ok(nodes) }, f);
  const [id] = (await w.create.handle(PM, "p", input({ logframeActivityId: "act" }))).value.ids;
  const update = make(facts([]));
  assert.equal((await update.handle(PM, id, { logframeActivityId: "actB" })).ok, true);
  assert.equal(w.store.get(id).logframeActivityId, "actB");
  assert.equal(w.store.get(id).snapshot().outputId, "out2", "the output follows the activity");
  assert.equal((await update.handle(PM, id, { logframeActivityId: "out1" })).ok, false, "only an ACTIVITY node");
  assert.equal((await update.handle(PM, id, { logframeActivityId: null })).ok, true);
  assert.equal(w.store.get(id).logframeActivityId, undefined);
  assert.equal(w.store.get(id).snapshot().outputId, undefined);

  const blocked = make(facts([[id, { liveRecords: 2 }]]));
  const refused = await blocked.handle(PM, id, { logframeActivityId: "actA" });
  assert.equal(refused.ok, false);
  assert.match(refused.error.message, /2 completed activities are already recorded/);
  assert.equal((await make(undefined).handle(PM, id, { logframeActivityId: "actA" })).ok, false, "without the readers the link cannot change");
});
