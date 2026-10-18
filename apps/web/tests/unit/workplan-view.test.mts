import { test } from "node:test";
import assert from "node:assert/strict";
import { assertExhaustive, findRawTokens, findForbiddenWorkplanTerms, allWorkplanCopy } from "@donordesk/domain";
import { ROLE_SURFACES, BUTTON_CAPABILITY, showsButton, surfaceFor } from "../../src/features/workplan/domain/role-surfaces.ts";
import { groupPlanList, groupFor, startOfWeek, PLAN_GROUP_LABEL } from "../../src/features/workplan/domain/plan-list-view.ts";
import { ROLES, capabilitiesForRole } from "../../src/lib/shared/capabilities.ts";

test("every role has a surface, and no surface offers a button its capabilities lack", () => {
  assertExhaustive(ROLE_SURFACES, [...ROLES], "ROLE_SURFACES");
  for (const role of ROLES) {
    const caps = capabilitiesForRole(role);
    for (const button of ROLE_SURFACES[role].buttons) assert.ok(caps.has(BUTTON_CAPABILITY[button]), `${role} is offered ${button} without ${BUTTON_CAPABILITY[button]}`);
  }
});

test("buttons are hidden, not disabled: a role sees only its own", () => {
  const caps = (r: string) => capabilitiesForRole(r);
  assert.equal(showsButton("FIELD_OFFICER", caps("FIELD_OFFICER"), "ADD_COMPLETED"), true);
  assert.equal(showsButton("FIELD_OFFICER", caps("FIELD_OFFICER"), "START_FROM_LOGFRAME"), false);
  assert.equal(showsButton("PROJECT_MANAGER", caps("PROJECT_MANAGER"), "START_FROM_LOGFRAME"), true);
  assert.equal(showsButton("VIEWER", caps("VIEWER"), "UPDATE_OWN_STATUS"), false);
  assert.equal(surfaceFor(null).buttons.length, 0, "an unknown role reads only");
  assert.equal(surfaceFor("FIELD_OFFICER").planView, "LIST");
  assert.equal(surfaceFor("FIELD_OFFICER").mineFilter, true);
});

const item = (id: string, start: string, end: string, extra = {}) => ({ id, title: id, plannedStart: start, plannedEnd: end, status: "PLANNED", signal: "ON_TIME", supportUserIds: [], ...extra });

test("the list groups into this week, next week, later and done; late and under way stay visible", () => {
  assert.equal(startOfWeek("2026-03-11"), "2026-03-09", "Wednesday -> Monday");
  assert.equal(startOfWeek("2026-03-15"), "2026-03-09", "Sunday belongs to the week before");
  const today = "2026-03-11";
  const groups = groupPlanList([
    item("later", "2026-04-20", "2026-04-21"),
    item("next", "2026-03-18", "2026-03-19"),
    item("this", "2026-03-13", "2026-03-14"),
    item("late-old", "2026-02-01", "2026-02-05", { signal: "LATE" }),
    item("running", "2026-03-01", "2026-06-01", { status: "IN_PROGRESS" }),
    item("done", "2026-02-01", "2026-02-02", { status: "DONE", signal: "DONE" }),
    item("cancelled", "2026-03-12", "2026-03-12", { status: "CANCELLED", signal: "CANCELLED" }),
  ], today);
  assert.deepEqual(groups.map((g) => [g.label, g.items.map((i) => i.id)]), [
    ["This week", ["late-old", "running", "this"]],
    ["Next week", ["next"]],
    ["Later", ["later"]],
    ["Done", ["cancelled", "done"]],
  ]);
  assert.equal(groups.at(-1)!.collapsed, true);
  assert.equal(groupFor(item("e", "2026-03-15", "2026-03-15"), today), "THIS_WEEK", "Sunday is still this week");
  assert.equal(groupFor(item("e", "2026-03-16", "2026-03-16"), today), "NEXT_WEEK");
});

test("'Mine' keeps the person's own and helped activities; empty groups are not shown", () => {
  const items = [item("a", "2026-03-12", "2026-03-12", { ownerUserId: "u1" }), item("b", "2026-03-12", "2026-03-12", { supportUserIds: ["u1"] }), item("c", "2026-03-12", "2026-03-12", { ownerUserId: "u2" })];
  const groups = groupPlanList(items, "2026-03-11", { mineOnly: true, userId: "u1" });
  assert.deepEqual(groups.map((g) => g.items.map((i) => i.id)), [["a", "b"]]);
  assert.deepEqual(groupPlanList([], "2026-03-11"), []);
  assert.deepEqual(Object.values(PLAN_GROUP_LABEL).flatMap(findForbiddenWorkplanTerms), []);
});

test("the work plan copy is clean of raw tokens and forbidden words", () => {
  for (const text of [...allWorkplanCopy(), ...Object.values(PLAN_GROUP_LABEL)]) {
    assert.deepEqual(findRawTokens(text), [], text);
    assert.deepEqual(findForbiddenWorkplanTerms(text), [], text);
  }
});

import { activitiesTabMode } from "../../src/features/workplan/domain/activities-tab-mode.ts";

test("a project without a plan looks exactly as before, for every role", () => {
  for (const role of ROLES) {
    const canPlan = ROLE_SURFACES[role].buttons.includes("ADD_PLANNED");
    const mode = activitiesTabMode({ role, planningVisible: true, plannedCount: 0, canPlan, view: undefined });
    assert.equal(mode.planned, false, `${role} sees today's page`);
    assert.equal(mode.showSwitch, canPlan, `${role}: the switch exists only for people who can start a plan`);
  }
});

test("hiding work planning removes the switch even when a plan exists; the data is kept", () => {
  const hidden = activitiesTabMode({ role: "PROJECT_MANAGER", planningVisible: false, plannedCount: 12, canPlan: true, view: "planned" });
  assert.deepEqual(hidden, { showSwitch: false, planned: false });
});

test("with a plan, each role opens on its own side, and an explicit view wins", () => {
  const open = (role: string, view?: string) => activitiesTabMode({ role, planningVisible: true, plannedCount: 5, canPlan: role === "PROJECT_MANAGER", view }).planned;
  assert.equal(open("FIELD_OFFICER"), true);
  assert.equal(open("VIEWER"), true);
  assert.equal(open("PROJECT_MANAGER"), true);
  assert.equal(open("COMPLIANCE_OFFICER"), false, "compliance keeps the completed list, as today");
  assert.equal(open("FIELD_OFFICER", "completed"), false);
  assert.equal(open("COMPLIANCE_OFFICER", "planned"), true);
});

import { shouldShowMyWeek } from "../../src/features/workplan/domain/my-week.ts";
test("only a field officer lands on My week, and only once there is planned work for them", () => {
  assert.equal(ROLE_SURFACES.FIELD_OFFICER.home, "MY_WEEK");
  assert.deepEqual(ROLES.filter((r) => ROLE_SURFACES[r].home === "MY_WEEK"), ["FIELD_OFFICER"]);
  assert.equal(shouldShowMyWeek("MY_WEEK", 0), false, "Home looks as before without a plan");
  assert.equal(shouldShowMyWeek("MY_WEEK", 3), true);
  assert.equal(shouldShowMyWeek("DEFAULT", 3), false);
});

import { describeChange, describeChanges } from "../../src/features/workplan/domain/plan-history-view.ts";
import { findRawTokens as rawTokens } from "@donordesk/domain/core/copy-lint.js";
test("history is written in words: statuses, dates, people and links never show a code, id or ISO date", () => {
  const ctx = { today: "2026-03-11", userId: "me", names: { u2: "Amina" } };
  assert.equal(describeChange("status", { from: "PLANNED", to: "IN_PROGRESS" }, ctx), "status: Not started to Under way");
  assert.equal(describeChange("plannedEnd", { from: "2026-03-12", to: "2027-01-05" }, ctx), "end date: 12 Mar to 5 Jan 2027");
  assert.equal(describeChange("ownerUserId", { from: null, to: "me" }, ctx), "lead: none to you");
  assert.equal(describeChange("ownerUserId", { from: "u2", to: "u9" }, ctx), "lead: Amina to a team member");
  assert.equal(describeChange("supportUserIds", { from: [], to: ["u2", "me"] }, ctx), "helpers: none to Amina, you");
  assert.equal(describeChange("targetCount", { from: 4, to: 5 }, ctx), "number of sessions: 4 to 5");
  assert.equal(describeChange("logframeActivityId", { from: "node-1", to: null }, ctx), "logframe activity: linked to none");
  assert.equal(describeChange("somethingNew", { from: { a: 1 }, to: "x" }, ctx), "details: changed to x");
  const all = describeChanges({ status: { from: "DONE", to: "CANCELLED" }, plannedStart: { from: "2026-03-10", to: "2026-03-14" } }, ctx);
  assert.equal(all, "status: Done to Cancelled; start date: 10 Mar to 14 Mar");
  assert.deepEqual(rawTokens(all), []);
});

import { filterGroupsByProject, projectChips, dueText, askedByText, totalIn } from "../../src/features/tasks/domain/my-work-view.ts";
import { peopleFor, canDo } from "../../src/features/tasks/domain/ask-people.ts";
import { TASK_KINDS, TASK_KIND_KEYS } from "@donordesk/domain/contexts/tasks/index.js";
import { Permissions } from "@donordesk/domain";

const workRow = (key: string, projectId: string, extra = {}) => ({ key, kind: "TASK" as const, projectId, projectTitle: projectId.toUpperCase(), title: key, assigneeId: "u1", state: "OPEN" as const, urgent: false, href: "/x", urgency: 1, ...extra });

test("my work: filter by project keeps order and drops empty groups; chips count what each project has", () => {
  const groups = [
    { key: "LATE" as const, label: "Late", items: [workRow("a", "p2"), workRow("b", "p1")] },
    { key: "LATER" as const, label: "Later", items: [workRow("c", "p2")] },
  ];
  assert.deepEqual(filterGroupsByProject(groups, "p1").map((g) => [g.label, g.items.map((i) => i.key)]), [["Late", ["b"]]]);
  assert.deepEqual(filterGroupsByProject(groups, "all").map((g) => g.items.length), [2, 1]);
  assert.deepEqual(projectChips(groups), [{ id: "p1", title: "P1", count: 1 }, { id: "p2", title: "P2", count: 2 }]);
  assert.equal(totalIn(groups), 3);
  assert.deepEqual(filterGroupsByProject([], "p1"), []);
});

test("my work words: due dates and who asked read as people say them", () => {
  assert.equal(dueText({ dueDate: "2026-03-01", state: "LATE" }, "2026-03-10"), "was due 1 Mar");
  assert.equal(dueText({ dueDate: "2026-03-10", state: "OPEN" }, "2026-03-10"), "due today");
  assert.equal(dueText({ dueDate: "2026-03-14", state: "OPEN" }, "2026-03-10"), "due 14 Mar");
  assert.equal(dueText({ state: "OPEN" }, "2026-03-10"), "");
  assert.equal(askedByText({ kind: "TASK", askedById: "me" }, "me", {}), "asked by you");
  assert.equal(askedByText({ kind: "TASK", askedById: "u2" }, "me", { u2: "Amina" }), "asked by Amina");
  assert.equal(askedByText({ kind: "TASK", askedById: "u9" }, "me", {}), "asked by a team member");
  assert.equal(askedByText({ kind: "PLAN_ITEM" }, "me", {}), "");
});

test("the dialog offers only people who could do what is asked, the lead first", () => {
  const people = [{ id: "u1", label: "Zed", role: "FIELD_OFFICER" }, { id: "u2", label: "Amina", role: "FIELD_OFFICER" }, { id: "u3", label: "Joe", role: "VIEWER" }, { id: "u4", label: "Pat", role: "ME_OFFICER" }];
  assert.deepEqual(peopleFor("RECORD_ACTIVITY", people, "u1").map((p) => p.id), ["u1", "u2", "u4"], "the viewer cannot record an activity; the lead is first");
  assert.deepEqual(peopleFor("ENTER_INDICATOR_VALUE", people).map((p) => p.id), ["u4"], "only roles that enter values");
  assert.deepEqual(peopleFor("REVIEW_RECORD", people).map((p) => p.id), [], "nobody here approves");
  assert.deepEqual(peopleFor("OTHER", people).map((p) => p.label), ["Amina", "Joe", "Pat", "Zed"]);
  for (const kind of TASK_KIND_KEYS) for (const role of ROLES) assert.equal(canDo(kind, role), Permissions.can(role, TASK_KINDS[kind].requires), `${kind} for ${role}`);
});
