import test from "node:test";
import assert from "node:assert/strict";
import {
  ALL_ROLES, Permissions, assertExhaustive, TASK_KINDS, TASK_KIND_KEYS, ProjectTask, suggestTaskDueDate,
  ASSIGNMENT_KINDS, ASSIGNMENT_KIND_KEYS, groupByDue, dueGroupOf, dedupeAssignments, teamWorkSummary, startOfWeekMonday, findRawTokens,
} from "../dist/index.js";

const base = { id: "t1", tenantId: "tenant-a", kind: "OTHER", projectId: "p", title: "Send the signed form", assigneeId: "u2", assignedById: "u1", dueDate: "2026-03-14" };
const make = (extra = {}) => ProjectTask.create({ ...base, ...extra });

test("every request kind is in the table, and each says who can be asked and how it closes", () => {
  assertExhaustive(TASK_KINDS, TASK_KIND_KEYS, "TASK_KINDS");
  for (const key of TASK_KIND_KEYS) {
    const spec = TASK_KINDS[key];
    assert.ok(["STATE", "MANUAL"].includes(spec.completion), key);
    assert.deepEqual(findRawTokens(spec.button), [], spec.button);
    assert.ok(spec.title("X").length > 0);
  }
  assert.deepEqual(TASK_KIND_KEYS.filter((k) => TASK_KINDS[k].completion === "MANUAL"), ["OTHER"], "only a free-text request closes by hand");
  assert.equal(TASK_KINDS.RECORD_ACTIVITY.title("Outreach visits"), "Add completed activity: Outreach visits");
  assert.equal(TASK_KINDS.OTHER.title(undefined), "Request");
});

test("the person asked must be someone who could meet the request", () => {
  assert.equal(TASK_KINDS.RECORD_ACTIVITY.requires, "activity.create");
  assert.equal(TASK_KINDS.ENTER_INDICATOR_VALUE.requires, "indicator.update");
  assert.equal(Permissions.can("FIELD_OFFICER", TASK_KINDS.RECORD_ACTIVITY.requires), true);
  assert.equal(Permissions.can("FIELD_OFFICER", TASK_KINDS.ENTER_INDICATOR_VALUE.requires), false);
  assert.equal(Permissions.can("VIEWER", TASK_KINDS.PROVIDE_EVIDENCE.requires), false);
});

test("a request needs what its kind needs, and nothing it must not have", () => {
  assert.equal(make().ok, true);
  assert.equal(make({ title: "  " }).ok, false);
  assert.equal(make({ assigneeId: "" }).ok, false);
  assert.equal(make({ dueDate: "2026-02-30" }).ok, false);
  assert.equal(make({ kind: "RECORD_ACTIVITY" }).ok, false, "about a planned activity, so it needs one");
  assert.equal(make({ kind: "RECORD_ACTIVITY", subjectType: "plannedActivity", subjectId: "pa1" }).ok, true);
  assert.equal(make({ kind: "RECORD_ACTIVITY", subjectType: "indicator", subjectId: "i1" }).ok, false, "not about an indicator");
  assert.equal(make({ kind: "OTHER", subjectType: "indicator", subjectId: "i1" }).ok, false, "a free request is about nothing in particular");
  assert.equal(make({ kind: "ENTER_INDICATOR_VALUE", subjectType: "indicator", subjectId: "i1" }).ok, false, "a value is for a period");
  assert.equal(make({ kind: "ENTER_INDICATOR_VALUE", subjectType: "indicator", subjectId: "i1", reportingPeriodId: "rp1" }).ok, true);
  const t = make({ urgent: true, details: "  by Friday " }).value.snapshot();
  assert.deepEqual([t.urgent, t.details, t.status], [true, "by Friday", "OPEN"]);
});

test("a free request is closed by the person asked; the others close by themselves, and nothing closes twice", () => {
  const manual = make().value;
  const done = manual.complete("u2", new Date("2026-03-10T10:00:00Z"), " Sent ");
  assert.equal(done.ok, true);
  assert.deepEqual([manual.status, manual.snapshot().completionNote, manual.snapshot().completedById], ["DONE", "Sent", "u2"]);
  assert.equal(manual.complete("u2", new Date()).ok, false);
  assert.equal(manual.cancel("u1", new Date()).ok, false);

  const state = make({ kind: "PROVIDE_EVIDENCE", subjectType: "plannedActivity", subjectId: "pa1" }).value;
  assert.equal(state.complete("u2", new Date()).ok, false, "a file request closes when the file is added, not when someone says so");
  assert.equal(state.closeByData(new Date()).ok, true);
  assert.equal(state.snapshot().closedByData, true);
  assert.equal(state.closeByData(new Date()).ok, false);

  const withdrawn = make().value;
  assert.equal(withdrawn.cancel("u1", new Date()).ok, true);
  assert.equal(withdrawn.status, "CANCELLED");
  assert.equal(withdrawn.isOpen, false);
});

test("the suggested due date is the activity's end + 3 days, or today + 3 days", () => {
  assert.equal(suggestTaskDueDate("RECORD_ACTIVITY", { today: "2026-03-10", subjectEnd: "2026-03-20" }), "2026-03-23");
  assert.equal(suggestTaskDueDate("RECORD_ACTIVITY", { today: "2026-03-10", subjectEnd: "2026-03-05" }), "2026-03-13", "an end already past starts from today");
  assert.equal(suggestTaskDueDate("OTHER", { today: "2026-02-27" }), "2026-03-02");
});

const a = (key, extra = {}) => ({ key, kind: "TASK", projectId: "p", projectTitle: "P", title: key, assigneeId: "u1", state: "OPEN", urgent: false, href: "/x", urgency: 5, ...extra });
const TODAY = "2026-03-11"; // a Wednesday

test("every assignment kind has a label, and role-based kinds say why", () => {
  assertExhaustive(ASSIGNMENT_KINDS, ASSIGNMENT_KIND_KEYS, "ASSIGNMENT_KINDS");
  for (const key of ASSIGNMENT_KIND_KEYS) {
    const spec = ASSIGNMENT_KINDS[key];
    assert.equal(spec.becauseOfRole, Boolean(spec.because), `${key}: a role-based item explains itself, any other does not`);
    assert.deepEqual(findRawTokens(spec.label), []);
  }
});

test("due groups: late, today, this week, later, no date; empty ones are not shown", () => {
  assert.equal(startOfWeekMonday(TODAY), "2026-03-09");
  assert.equal(dueGroupOf(a("x", { dueDate: "2026-03-10" }), TODAY), "LATE");
  assert.equal(dueGroupOf(a("x", { dueDate: "2026-03-30", state: "LATE" }), TODAY), "LATE", "a source that says late wins");
  assert.equal(dueGroupOf(a("x", { dueDate: TODAY }), TODAY), "TODAY");
  assert.equal(dueGroupOf(a("x", { dueDate: "2026-03-15" }), TODAY), "THIS_WEEK", "Sunday is still this week");
  assert.equal(dueGroupOf(a("x", { dueDate: "2026-03-16" }), TODAY), "LATER");
  assert.equal(dueGroupOf(a("x"), TODAY), "NO_DATE");
  const groups = groupByDue([a("later", { dueDate: "2026-04-01" }), a("today", { dueDate: TODAY }), a("late", { dueDate: "2026-03-01" })], TODAY);
  assert.deepEqual(groups.map((g) => [g.label, g.items.map((i) => i.key)]), [["Late", ["late"]], ["Today", ["today"]], ["Later", ["later"]]]);
  assert.deepEqual(groupByDue([], TODAY), []);
});

test("inside a group: urgent first, then the usual urgency order, then date and title", () => {
  const groups = groupByDue([
    a("c", { dueDate: "2026-03-12", urgency: 3 }), a("b", { dueDate: "2026-03-12", urgency: 1 }), a("urgent", { dueDate: "2026-03-14", urgent: true, urgency: 9 }), a("a", { dueDate: "2026-03-12", urgency: 1 }),
  ], TODAY);
  assert.deepEqual(groups[0].items.map((i) => i.key), ["urgent", "a", "b", "c"]);
});

test("the same assignment from two sources is shown once", () => {
  assert.deepEqual(dedupeAssignments([a("PLAN_ITEM:1"), a("TASK:2"), a("PLAN_ITEM:1", { title: "dup" })]).map((i) => i.title), ["PLAN_ITEM:1", "TASK:2"]);
});

test("the team view counts each person's own work, never the role-based reviews", () => {
  const rows = teamWorkSummary([
    a("1", { assigneeId: "amina", dueDate: "2026-03-01" }), a("2", { assigneeId: "amina", dueDate: "2026-03-12" }), a("3", { assigneeId: "amina", dueDate: "2026-05-01" }),
    a("4", { assigneeId: "joe", dueDate: TODAY }), a("5", { assigneeId: "joe", kind: "ACTIVITY_REVIEW", dueDate: "2026-03-01" }),
  ], TODAY);
  assert.deepEqual(rows, [{ assigneeId: "amina", open: 3, late: 1, dueThisWeek: 1 }, { assigneeId: "joe", open: 1, late: 0, dueThisWeek: 1 }]);
});

test("who may ask and who may see the team: matches the plan's table", () => {
  const can = (p) => ALL_ROLES.filter((r) => Permissions.can(r, p)).sort();
  assert.deepEqual(can("task.assign"), ["ADMIN", "COMPLIANCE_OFFICER", "GRANTS_OFFICER", "ME_OFFICER", "PROJECT_MANAGER"]);
  assert.deepEqual(can("team.view-work"), ["ADMIN", "ME_OFFICER", "PROJECT_MANAGER"]);
});
