import test from "node:test";
import assert from "node:assert/strict";
import { TenantId, ProjectTask, ReportingPeriod, ChecklistItem } from "@donordesk/domain";
import {
  CreateTaskHandler, CompleteTaskHandler, CancelTaskHandler, TaskReconciler, AssignmentQueue, ListAssignmentsHandler, ListTeamWorkHandler,
  SetIndicatorOwnerHandler, SetPeriodOwnerHandler, AssignChecklistItemHandler, CreateActivityUpdateHandler,
} from "../dist/index.js";
import { assignmentSourceContract } from "./support/assignment-source-contract.mjs";

const tenantId = TenantId.create("tenant-a");
const ctxFor = (userId, role) => ({ tenant: { tenantId, userId, role }, requestId: "r" });
const PM = ctxFor("pm", "PROJECT_MANAGER");
const FIELD = ctxFor("fo", "FIELD_OFFICER");
const VIEWER = ctxFor("v", "VIEWER");
const ADMIN = ctxFor("ad", "ADMIN");
const ok = (value) => ({ ok: true, value });
const NOW = new Date("2026-03-10T09:00:00Z");
const clock = { now: () => NOW };

function world() {
  const store = new Map();
  const audit = [];
  const notes = [];
  let n = 0;
  const ids = { generate: () => `t${++n}` };
  const tasks = {
    create: async (t) => (store.set(t.id, t), ok(t)),
    update: async (t) => (store.set(t.id, t), ok(t)),
    findById: async (id) => ok(store.get(id) ?? null),
    findOpenByProject: async (p) => ok([...store.values()].filter((t) => t.isOpen && t.projectId === p)),
    findOpenByAssignee: async (a) => ok([...store.values()].filter((t) => t.isOpen && t.assigneeId === a)),
  };
  const subjects = {
    resolve: async (type, id) => ok(id === "pa1" ? { projectId: "p", title: "Outreach visits", end: "2026-03-20" } : id === "pa-other" ? { projectId: "elsewhere", title: "X" } : id === "ind1" ? { projectId: "p", title: "V-01 Children vaccinated" } : null),
  };
  const roster = { activeMembers: async (p) => ok(p === "p" ? [{ userId: "pm", role: "PROJECT_MANAGER" }, { userId: "fo", role: "FIELD_OFFICER" }, { userId: "me", role: "ME_OFFICER" }, { userId: "v", role: "VIEWER" }] : []) };
  const notify = { notify: async (x) => void notes.push(x) };
  const auditLog = { record: async (e) => void audit.push(e) };
  return { store, audit, notes, tasks, subjects, roster, notify, auditLog, ids, create: new CreateTaskHandler(ids, tasks, subjects, roster, notify, auditLog, clock) };
}

const ask = (extra = {}) => ({ kind: "RECORD_ACTIVITY", subjectType: "plannedActivity", subjectId: "pa1", assigneeId: "fo", urgent: false, ...extra });

test("asking: the title is written for the user, the due date is suggested from the activity, the person is told, and it is audited", async () => {
  const w = world();
  const out = await w.create.handle(PM, "p", ask());
  assert.equal(out.ok, true, out.error?.message);
  const t = w.store.get(out.value.id).snapshot();
  assert.deepEqual([t.title, t.dueDate, t.assigneeId, t.assignedById, t.status], ["Add completed activity: Outreach visits", "2026-03-23", "fo", "pm", "OPEN"]);
  assert.deepEqual([w.notes[0].recipientId, w.notes[0].type, w.notes[0].title], ["fo", "ASSIGNMENT", "New request"]);
  assert.match(w.notes[0].message, /Add completed activity: Outreach visits\. Due 23 Mar\./);
  assert.equal(w.audit[0].eventType, "task.created");
  const urgent = await w.create.handle(PM, "p", ask({ urgent: true, dueDate: "2026-03-12", note: "Before the visit" }));
  assert.equal(w.notes.at(-1).title, "Urgent request");
  assert.deepEqual([w.store.get(urgent.value.id).snapshot().dueDate, w.store.get(urgent.value.id).snapshot().details], ["2026-03-12", "Before the visit"]);
});

test("asking: only people who may ask; only active members who could do it; the subject must be in this project", async () => {
  const w = world();
  assert.equal((await w.create.handle(FIELD, "p", ask({ assigneeId: "pm" }))).error.code, "FORBIDDEN", "a field officer cannot make requests");
  assert.equal((await w.create.handle(VIEWER, "p", ask())).error.code, "FORBIDDEN");
  const outsider = await w.create.handle(PM, "p", ask({ assigneeId: "stranger" }));
  assert.equal(outsider.error.details.field, "assigneeId");
  const cannot = await w.create.handle(PM, "p", ask({ kind: "ENTER_INDICATOR_VALUE", subjectType: "indicator", subjectId: "ind1", reportingPeriodId: "rp1", assigneeId: "fo" }));
  assert.equal(cannot.ok, false, "a field officer cannot enter indicator values, so the request could never be met");
  assert.match(cannot.error.message, /role does not allow/);
  assert.equal((await w.create.handle(PM, "p", ask({ subjectId: "pa-other" }))).error.code, "NOT_FOUND", "another project's activity");
  assert.equal((await w.create.handle(PM, "p", ask({ subjectId: "nope" }))).error.code, "NOT_FOUND");
  assert.equal(w.store.size, 0, "nothing saved for any refusal");
  assert.equal(w.notes.length, 0);
});

test("a free-text request carries its own title and needs no subject; the others ignore a typed title", async () => {
  const w = world();
  const free = await w.create.handle(PM, "p", { kind: "OTHER", assigneeId: "me", title: "Send the donor the signed form", urgent: false });
  assert.equal(w.store.get(free.value.id).title, "Send the donor the signed form");
  assert.equal((await w.create.handle(PM, "p", { kind: "OTHER", assigneeId: "me", urgent: false })).ok, false, "a free request needs words");
  const typed = await w.create.handle(PM, "p", ask({ title: "Something else" }));
  assert.equal(w.store.get(typed.value.id).title, "Add completed activity: Outreach visits");
});

test("completing: a free request by the person asked or the asker; a data request cannot be ticked off; strangers cannot", async () => {
  const w = world();
  const free = (await w.create.handle(PM, "p", { kind: "OTHER", assigneeId: "me", title: "Send the form", urgent: false })).value.id;
  const complete = new CompleteTaskHandler(w.tasks, w.auditLog, clock);
  assert.equal((await complete.handle(ctxFor("someone", "FIELD_OFFICER"), free, {})).error.code, "FORBIDDEN");
  assert.equal((await complete.handle(ctxFor("me", "ME_OFFICER"), free, { note: "Sent" })).ok, true);
  assert.equal(w.audit.at(-1).eventType, "task.completed");
  assert.equal((await complete.handle(ctxFor("me", "ME_OFFICER"), free, {})).ok, false, "already closed");
  const data = (await w.create.handle(PM, "p", ask())).value.id;
  assert.match((await complete.handle(FIELD, data, {})).error.message, /closes by itself/);
  assert.equal((await complete.handle(FIELD, "nope", {})).error.code, "NOT_FOUND");
});

test("withdrawing: the asker or an admin only", async () => {
  const w = world();
  const id = (await w.create.handle(PM, "p", ask())).value.id;
  const cancel = new CancelTaskHandler(w.tasks, w.auditLog, clock);
  assert.equal((await cancel.handle(FIELD, id)).error.code, "FORBIDDEN", "the person asked cannot withdraw it");
  assert.equal((await cancel.handle(ADMIN, id)).ok, true);
  assert.equal(w.store.get(id).status, "CANCELLED");
  assert.equal(w.audit.at(-1).eventType, "task.cancelled");
  assert.equal((await cancel.handle(PM, id)).ok, false);
});

test("the reconciler closes met requests (audited), leaves the rest, and never touches a free request", async () => {
  const w = world();
  const a = (await w.create.handle(PM, "p", ask())).value.id;
  const b = (await w.create.handle(PM, "p", ask({ kind: "PROVIDE_EVIDENCE" }))).value.id;
  const free = (await w.create.handle(PM, "p", { kind: "OTHER", assigneeId: "fo", title: "Call the partner", urgent: false })).value.id;
  const facts = { satisfiedIds: async (list) => ok(new Set(list.filter((t) => t.id === a || t.id === free).map((t) => t.id))) };
  const reconciler = new TaskReconciler(w.tasks, facts, w.auditLog, clock);
  const out = await reconciler.reconcile(tenantId, "fo", { assigneeId: "fo" });
  assert.equal(out.value, 1, "the free request is never closed from data, even if a checker said so");
  assert.deepEqual([w.store.get(a).status, w.store.get(b).status, w.store.get(free).status], ["DONE", "OPEN", "OPEN"]);
  assert.equal(w.store.get(a).snapshot().closedByData, true);
  assert.equal(w.audit.at(-1).eventType, "task.closed_by_data");
  assert.equal((await reconciler.reconcile(tenantId, "fo", { projectId: "p" })).value, 0, "nothing more to close");
  const failing = new TaskReconciler(w.tasks, { satisfiedIds: async () => ({ ok: false, error: new Error("db") }) }, w.auditLog, clock);
  await assert.doesNotReject(() => failing.reconcileForCurrentUser(FIELD), "a failure never reaches the caller");
});

test("a completed activity that meets a request closes it in the same breath", async () => {
  const w = world();
  const id = (await w.create.handle(PM, "p", ask())).value.id;
  const facts = { satisfiedIds: async (list) => ok(new Set(list.map((t) => t.id))) };
  const reconciler = new TaskReconciler(w.tasks, facts, w.auditLog, clock);
  const created = [];
  const handler = new CreateActivityUpdateHandler({ generate: () => "act1" }, { create: async (a) => (created.push(a), ok(a)) }, w.auditLog, undefined, undefined, reconciler);
  const out = await handler.handle(FIELD, { projectId: "p", reportingPeriodId: "rp", activityTitle: "Visit", activityDate: "2026-03-10T00:00:00.000Z", summary: "Held.", achievements: "", challenges: "", lessonsLearned: "", nextSteps: "", attachedEvidenceIds: [] });
  assert.equal(out.ok, true);
  assert.equal(w.store.get(id).status, "DONE");
});

const A = (key, extra = {}) => ({ key, kind: "TASK", projectId: "p", projectTitle: "Clinics", title: key, assigneeId: "fo", state: "OPEN", urgent: false, href: "/projects/p/x", urgency: 5, ...extra });

test("the queue asks every source once, merges, and shows the same thing once; one failing source fails the read", async () => {
  const seen = [];
  const source = (kind, items) => ({ kind, list: async (q) => (seen.push([kind, q.assigneeId]), ok(items)) });
  const queue = new AssignmentQueue([source("TASK", [A("TASK:1")]), source("PLAN_ITEM", [A("PLAN_ITEM:1", { kind: "PLAN_ITEM" }), A("TASK:1")])]);
  const out = await queue.list({ tenantId, today: "2026-03-10", assigneeId: "fo" });
  assert.deepEqual(out.value.map((a) => a.key), ["TASK:1", "PLAN_ITEM:1"]);
  assert.deepEqual(seen, [["TASK", "fo"], ["PLAN_ITEM", "fo"]]);
  const broken = new AssignmentQueue([source("TASK", []), { kind: "PLAN_ITEM", list: async () => ({ ok: false, error: new Error("x") }) }]);
  assert.equal((await broken.list({ tenantId, today: "2026-03-10" })).ok, false);
});

test("my work: always mine unless I may see the team's; it is grouped, and met requests are closed first", async () => {
  const calls = [];
  const queue = { list: async (q) => (calls.push(q), ok([A("a", { dueDate: "2026-03-01" }), A("b", { dueDate: "2026-03-10" }), A("c")])) };
  const reconciler = { reconcile: async (...args) => (calls.push(["reconcile", args[2]]), ok(0)) };
  const handler = new ListAssignmentsHandler(queue, reconciler, clock);
  const mine = await handler.handle(FIELD);
  assert.deepEqual(mine.value.groups.map((g) => [g.label, g.items.map((i) => i.key)]), [["Late", ["a"]], ["Today", ["b"]], ["No date", ["c"]]]);
  assert.deepEqual(calls[0], ["reconcile", { assigneeId: "fo" }], "reconciled before it is read");
  assert.equal(calls[1].assigneeId, "fo");
  assert.equal((await handler.handle(FIELD, { userId: "pm" })).error.code, "FORBIDDEN", "a field officer cannot read someone else's work");
  assert.equal((await handler.handle(PM, { userId: "fo" })).ok, true);
  assert.equal((await handler.handle(PM, { userId: "fo", projectId: "p" })).ok, true);
  assert.equal(calls.at(-1).projectId, "p");
});

test("the team view: managers only, people x counts", async () => {
  const queue = { list: async () => ok([A("1", { assigneeId: "amina", dueDate: "2026-03-01" }), A("2", { assigneeId: "amina", dueDate: "2026-03-12" }), A("3", { assigneeId: "joe", dueDate: "2026-03-10" })]) };
  const handler = new ListTeamWorkHandler(queue, { reconcile: async () => ok(0) }, clock);
  assert.equal((await handler.handle(FIELD, "p")).error.code, "FORBIDDEN");
  assert.equal((await handler.handle(VIEWER, "p")).error.code, "FORBIDDEN");
  assert.deepEqual((await handler.handle(PM, "p")).value.rows, [{ assigneeId: "amina", open: 2, late: 1, dueThisWeek: 1 }, { assigneeId: "joe", open: 1, late: 0, dueThisWeek: 1 }]);
});

function ownersWorld() {
  const audit = [];
  const roster = { activeMembers: async () => ok([{ userId: "fo", role: "FIELD_OFFICER" }, { userId: "me", role: "ME_OFFICER" }]) };
  const log = { record: async (e) => void audit.push(e) };
  return { audit, roster, log };
}

test("indicator lead: logframe managers only, an active member or nobody, audited, a no-op is silent", async () => {
  const w = ownersWorld();
  const stored = { projectId: "p", responsibleUserId: undefined, update(patch) { this.responsibleUserId = patch.responsibleUserId; } };
  const handler = new SetIndicatorOwnerHandler({ findById: async () => ok(stored), update: async (i) => ok(i) }, w.roster, w.log);
  assert.equal((await handler.handle(FIELD, "i1", { userId: "me" })).error.code, "FORBIDDEN");
  assert.equal((await handler.handle(PM, "i1", { userId: "stranger" })).error.details.field, "userId");
  assert.equal((await handler.handle(PM, "i1", { userId: "me" })).ok, true);
  assert.equal(stored.responsibleUserId, "me");
  assert.equal((await handler.handle(PM, "i1", { userId: "me" })).ok, true);
  assert.equal(w.audit.length, 1, "no change, no audit event");
  assert.equal((await handler.handle(PM, "i1", { userId: null })).ok, true);
  assert.equal(stored.responsibleUserId, undefined, "removing the lead clears it");
  assert.equal(w.audit.at(-1).eventType, "indicator.owner_changed");
});

test("report lead and compliance item lead follow the same rule; the new compliance lead is told", async () => {
  const w = ownersWorld();
  const period = { projectId: "p", responsibleOfficerId: undefined, assignResponsibleOfficer(id) { this.responsibleOfficerId = id; } };
  const periods = new SetPeriodOwnerHandler({ findById: async () => ok(period), update: async (p) => ok(p) }, w.roster, w.log);
  assert.equal((await periods.handle(ctxFor("c", "COMPLIANCE_OFFICER"), "rp1", { userId: "me" })).error.code, "FORBIDDEN");
  assert.equal((await periods.handle(PM, "rp1", { userId: "me" })).ok, true);
  assert.equal(period.responsibleOfficerId, "me");
  assert.equal(w.audit.at(-1).eventType, "report.owner_changed");

  const notes = [];
  const item = { projectId: "p", title: "Confirm safeguarding", assignedToId: undefined, assign(id) { this.assignedToId = id; }, unassign() { this.assignedToId = undefined; } };
  const checklist = new AssignChecklistItemHandler({ findById: async () => ok(item), update: async (c) => ok(c) }, w.roster, { notify: async (n) => void notes.push(n) }, w.log);
  assert.equal((await checklist.handle(FIELD, "c1", { userId: "fo" })).error.code, "FORBIDDEN");
  assert.equal((await checklist.handle(PM, "c1", { userId: "fo" })).ok, true);
  assert.deepEqual([notes[0].recipientId, notes[0].type, notes[0].message], ["fo", "CHECKLIST_ASSIGNED", "Confirm safeguarding"]);
  assert.equal((await checklist.handle(PM, "c1", { userId: null })).ok, true);
  assert.equal(item.assignedToId, undefined);
  assert.equal(notes.length, 1, "taking someone off tells no one");
});

// The shared contract, against an in-memory source built the way a real one is.
const memorySource = (kind, rows) => ({ kind, list: async (q) => ok(rows.filter((r) => (q.assigneeId ? r.assigneeId === q.assigneeId : !["EVIDENCE_REVIEW", "ACTIVITY_REVIEW"].includes(kind)))) });
const sample = (kind, extra = {}) => ({ key: `${kind}:1`, kind, projectId: "p", projectTitle: "Clinics", title: "Something", assigneeId: "fo", dueDate: "2026-03-01", state: "LATE", urgent: false, href: "/projects/p/x", urgency: 2, ...extra });
const q = { tenantId, today: "2026-03-10", assigneeId: "fo" };
for (const kind of ["TASK", "PLAN_ITEM", "CHECKLIST_ITEM", "REPORT_DEADLINE"]) {
  assignmentSourceContract(test, `in-memory ${kind}`, { make: async () => ({ source: memorySource(kind, [sample(kind), sample(kind, { key: `${kind}:2`, dueDate: undefined, state: "OPEN" })]), query: q }), makeEmpty: async () => ({ source: memorySource(kind, []), query: q }) });
}
for (const kind of ["EVIDENCE_REVIEW", "ACTIVITY_REVIEW"]) {
  assignmentSourceContract(test, `in-memory ${kind}`, { make: async () => ({ source: memorySource(kind, [sample(kind, { because: "because you approve" })]), query: q }), makeEmpty: async () => ({ source: memorySource(kind, []), query: q }) });
}
