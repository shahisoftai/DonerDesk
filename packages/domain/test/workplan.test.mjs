import test from "node:test";
import assert from "node:assert/strict";
import {
  ALL_ROLES, Permissions, findRawTokens, assertExhaustive,
  PLAN_STATUSES, PLAN_ACTIONS, PLAN_STATUS_TRANSITIONS, canApplyPlanAction, planActionFor,
  DELIVERY_STATES, DELIVERY_SIGNAL, deliveryState, deliverySignal, deliveryReason, NO_DELIVERY,
  suggestPlanStatus, expandRecurrence, validateRecurrence, MAX_OCCURRENCES, reasonRequired, proposePlanDates,
  suggestPlanLinks, checkAssignable, MAX_SUPPORT_USERS, canActOnPlanItem, PLAN_ITEM_ACTIONS, PLAN_ITEM_ACTION_RULES,
  createPlanRevision, PlannedActivity, allWorkplanCopy, findForbiddenWorkplanTerms, PLAN_STATUS_LABEL,
  addMonths, formatShortDate, isPlainDate,
} from "../dist/index.js";

test("status transitions: every cell as declared, and the table covers every action", () => {
  const ALLOWED = { START: ["PLANNED"], COMPLETE: ["PLANNED", "IN_PROGRESS"], REOPEN: ["DONE"], CANCEL: ["PLANNED", "IN_PROGRESS"], RESTORE: ["CANCELLED"] };
  assertExhaustive(PLAN_STATUS_TRANSITIONS, PLAN_ACTIONS, "PLAN_STATUS_TRANSITIONS");
  for (const [action, allowed] of Object.entries(ALLOWED)) for (const s of PLAN_STATUSES) assert.equal(canApplyPlanAction(s, action), allowed.includes(s), `${action} from ${s}`);
  assert.equal(planActionFor("PLANNED", "IN_PROGRESS"), "START");
  assert.equal(planActionFor("DONE", "IN_PROGRESS"), "REOPEN");
  assert.equal(planActionFor("DONE", "PLANNED"), undefined);
});

const TODAY = "2026-03-10";
const span = (status, start, end, extra = {}) => ({ status, plannedStart: start, plannedEnd: end, ...extra });
const started = { ...NO_DELIVERY, liveRecords: 1 };

const STATE_CASES = [
  ["cancelled wins", span("CANCELLED", "2026-01-01", "2026-01-02"), NO_DELIVERY, "CANCELLED"],
  ["done on time", span("DONE", "2026-03-01", "2026-03-12", { completedOn: "2026-03-09" }), NO_DELIVERY, "DONE"],
  ["done late", span("DONE", "2026-03-01", "2026-03-05", { completedOn: "2026-03-09" }), NO_DELIVERY, "DONE_LATE"],
  ["past its end", span("IN_PROGRESS", "2026-03-01", "2026-03-05"), started, "OVERDUE"],
  ["not started after start", span("PLANNED", "2026-03-01", "2026-03-20"), NO_DELIVERY, "LATE_START"],
  ["started by a completed activity", span("PLANNED", "2026-03-01", "2026-03-20"), started, "IN_PROGRESS"],
  ["started by status", span("IN_PROGRESS", "2026-03-12", "2026-03-20"), NO_DELIVERY, "IN_PROGRESS"],
  ["due within 7 days", span("PLANNED", "2026-03-17", "2026-03-20"), NO_DELIVERY, "DUE_SOON"],
  ["later", span("PLANNED", "2026-03-18", "2026-03-20"), NO_DELIVERY, "UPCOMING"],
  ["starts today", span("PLANNED", TODAY, "2026-03-20"), NO_DELIVERY, "DUE_SOON"],
];

test("delivery state: every case for an activity and for a milestone (start = end)", () => {
  for (const [name, item, facts, want] of STATE_CASES) assert.equal(deliveryState(item, facts, TODAY), want, name);
  // Milestones through the same table, no special case.
  assert.equal(deliveryState(span("PLANNED", "2026-03-09", "2026-03-09"), NO_DELIVERY, TODAY), "OVERDUE");
  assert.equal(deliveryState(span("PLANNED", TODAY, TODAY), NO_DELIVERY, TODAY), "DUE_SOON");
  assert.equal(deliveryState(span("PLANNED", "2026-04-01", "2026-04-01"), NO_DELIVERY, TODAY), "UPCOMING");
  assert.equal(deliveryState(span("DONE", "2026-03-09", "2026-03-09", { completedOn: "2026-03-09" }), NO_DELIVERY, TODAY), "DONE");
  assert.deepEqual([...new Set(STATE_CASES.map((c) => c[3]))].sort(), [...DELIVERY_STATES].sort(), "every state has a case");
});

test("one signal per state, and the tooltip names the reason", () => {
  assertExhaustive(DELIVERY_SIGNAL, DELIVERY_STATES, "DELIVERY_SIGNAL");
  assert.equal(deliverySignal("LATE_START"), "LATE");
  assert.equal(deliverySignal("DONE_LATE"), "DONE");
  assert.equal(deliveryReason("OVERDUE", span("IN_PROGRESS", "2026-03-01", "2026-03-03"), TODAY), "past its end date 3 Mar");
  assert.equal(deliveryReason("DONE_LATE", span("DONE", "2026-03-01", "2026-03-05", { completedOn: "2026-03-09" }), TODAY), "done 4 days late");
  assert.equal(deliveryReason("DONE", span("DONE", "2026-03-01", "2026-03-05"), TODAY), undefined);
});

test("status suggestions never decide, only suggest", () => {
  assert.equal(suggestPlanStatus(span("PLANNED", "2026-03-01", "2026-03-20"), started), "IN_PROGRESS");
  assert.equal(suggestPlanStatus(span("IN_PROGRESS", "2026-03-01", "2026-03-20", { targetCount: 2 }), { ...started, deliveredCount: 2 }), "DONE");
  assert.equal(suggestPlanStatus(span("IN_PROGRESS", "2026-03-01", "2026-03-20", { targetCount: 3 }), { ...started, deliveredCount: 2 }), undefined);
  assert.equal(suggestPlanStatus(span("PLANNED", TODAY, TODAY), { ...started, acceptedRecords: 1 }), "DONE");
  assert.equal(suggestPlanStatus(span("DONE", TODAY, TODAY), { ...started, acceptedRecords: 1 }), undefined);
  assert.equal(suggestPlanStatus(span("PLANNED", "2026-03-01", "2026-03-20"), NO_DELIVERY), undefined);
});

test("recurrence: month ends, leap years, weekly, cap", () => {
  const monthly = expandRecurrence({ every: "MONTH", interval: 1, until: "2028-05-31" }, { start: "2028-01-31", end: "2028-02-01" });
  assert.deepEqual(monthly.occurrences.map((o) => o.start), ["2028-01-31", "2028-02-29", "2028-03-31", "2028-04-30", "2028-05-31"]);
  assert.equal(monthly.occurrences[1].end, "2028-03-01", "each keeps the first one's length");
  assert.equal(addMonths("2027-01-31", 1), "2027-02-28");
  const weekly = expandRecurrence({ every: "WEEK", interval: 1, until: "2026-03-22" }, { start: "2026-03-01", end: "2026-03-01" });
  assert.deepEqual(weekly.occurrences.map((o) => o.start), ["2026-03-01", "2026-03-08", "2026-03-15", "2026-03-22"]);
  const capped = expandRecurrence({ every: "WEEK", interval: 1, until: "2099-01-01" }, { start: "2026-01-01", end: "2026-01-01" });
  assert.equal(capped.occurrences.length, MAX_OCCURRENCES);
  assert.equal(capped.capped, true);
  assert.equal(validateRecurrence({ every: "MONTH", interval: 1, until: "2025-01-01" }, "2026-01-01").ok, false);
  assert.equal(validateRecurrence({ every: "MONTH", interval: 0, until: "2027-01-01" }, "2026-01-01").ok, false);
});

test("a reason is asked only when the original end has passed or a report uses it", () => {
  assert.equal(reasonRequired({ originalEnd: "2026-03-11" }, TODAY, { reportUsesIt: false }), false);
  assert.equal(reasonRequired({ originalEnd: TODAY }, TODAY, { reportUsesIt: false }), false);
  assert.equal(reasonRequired({ originalEnd: "2026-03-09" }, TODAY, { reportUsesIt: false }), true);
  assert.equal(reasonRequired({ originalEnd: "2026-12-01" }, TODAY, { reportUsesIt: true }), true);
});

test("proposed dates spread in order across the project; monthly rows repeat to the end", () => {
  const out = proposePlanDates([{ nodeId: "a" }, { nodeId: "m", monthly: true }, { nodeId: "b" }], { start: "2026-01-01", end: "2026-12-31" });
  assert.deepEqual(out[0], { nodeId: "a", start: "2026-01-01", end: "2026-07-01" });
  assert.deepEqual(out[2], { nodeId: "b", start: "2026-07-02", end: "2026-12-31" });
  assert.deepEqual(out[1], { nodeId: "m", start: "2026-01-01", end: "2026-01-07", repeats: { every: "MONTH", interval: 1, until: "2026-12-31" } });
  const many = proposePlanDates(Array.from({ length: 30 }, (_, i) => ({ nodeId: `n${i}` })), { start: "2026-01-01", end: "2026-01-10" });
  for (const p of many) assert.ok(p.start <= p.end && p.end <= "2026-01-10" && p.start >= "2026-01-01", JSON.stringify(p));
});

test("plan link suggestions: chosen logframe activity first, then mine, then nearest date; closed ones never offered", () => {
  const c = (id, extra) => ({ id, status: "PLANNED", plannedStart: "2026-03-01", plannedEnd: "2026-03-05", ...extra });
  const out = suggestPlanLinks({ userId: "u1", date: "2026-03-20", logframeActivityId: "n1" }, [
    c("far", { plannedStart: "2026-06-01", plannedEnd: "2026-06-02" }),
    c("near", { plannedStart: "2026-03-18", plannedEnd: "2026-03-25" }),
    c("node", { logframeActivityId: "n1" }),
    c("mine", { ownerUserId: "u1" }),
    c("done", { ownerUserId: "u1", status: "DONE" }),
  ]);
  assert.deepEqual(out.map((s) => s.id), ["node", "mine", "near"]);
  assert.deepEqual(out[0].reasons, ["Same logframe activity", "Planned for 1 Mar to 5 Mar"]);
  assert.deepEqual(out[1].reasons, ["You lead it", "Planned for 1 Mar to 5 Mar"]);
});

test("only active members can lead or help; duplicates and the lead are removed from helpers", () => {
  const members = new Set(["a", "b", "c"]);
  const r = checkAssignable({ ownerUserId: "a", supportUserIds: ["a", "b", "b"] }, members);
  assert.deepEqual(r.value, { ownerUserId: "a", supportUserIds: ["b"] });
  assert.equal(checkAssignable({ ownerUserId: "x" }, members).ok, false);
  const many = new Set(Array.from({ length: 20 }, (_, i) => `m${i}`));
  assert.equal(checkAssignable({ supportUserIds: [...many].slice(0, MAX_SUPPORT_USERS + 1) }, many).ok, false);
});

test("canActOnPlanItem: managers do everything, leads change status and notes, viewers only read", () => {
  assertExhaustive(PLAN_ITEM_ACTION_RULES, PLAN_ITEM_ACTIONS, "PLAN_ITEM_ACTION_RULES");
  const item = { ownerUserId: "lead", supportUserIds: ["helper"] };
  for (const role of ALL_ROLES) {
    const manager = Permissions.can(role, "workplan.manage");
    for (const action of PLAN_ITEM_ACTIONS) {
      const someoneElse = canActOnPlanItem({ userId: "other", role }, item, action);
      assert.equal(someoneElse, action === "VIEW" ? Permissions.can(role, "project.view") : manager, `${role} ${action} (not on it)`);
    }
  }
  assert.equal(canActOnPlanItem({ userId: "lead", role: "FIELD_OFFICER" }, item, "CHANGE_STATUS"), true);
  assert.equal(canActOnPlanItem({ userId: "helper", role: "FIELD_OFFICER" }, item, "EDIT_NOTES"), true);
  assert.equal(canActOnPlanItem({ userId: "lead", role: "FIELD_OFFICER" }, item, "MOVE"), false);
  assert.equal(canActOnPlanItem({ userId: "lead", role: "VIEWER" }, item, "CHANGE_STATUS"), false);
});

function planned(extra = {}) {
  const r = PlannedActivity.create({ id: "p1", tenantId: "t", projectId: "pr", title: " Outreach ", plannedStart: "2026-03-01", plannedEnd: "2026-03-05", createdById: "u", ...extra });
  assert.ok(r.ok, r.error?.message);
  return r.value;
}

test("aggregate: created with original dates, milestone from one date, invariants as Results", () => {
  const p = planned();
  assert.equal(p.title, "Outreach");
  assert.equal(p.kind, "ACTIVITY");
  assert.equal(p.originalEnd, "2026-03-05");
  assert.equal(planned({ plannedEnd: "2026-03-01" }).kind, "MILESTONE");
  assert.equal(PlannedActivity.create({ id: "x", tenantId: "t", projectId: "p", title: "T", plannedStart: "2026-03-05", plannedEnd: "2026-03-01", createdById: "u" }).ok, false);
  assert.equal(PlannedActivity.create({ id: "x", tenantId: "t", projectId: "p", title: " ", plannedStart: "2026-03-01", plannedEnd: "2026-03-01", createdById: "u" }).ok, false);
  assert.equal(PlannedActivity.create({ id: "x", tenantId: "t", projectId: "p", title: "T", plannedStart: "2026-03-01", plannedEnd: "2026-03-01", targetCount: 0, createdById: "u" }).ok, false);
});

test("aggregate: reschedule keeps original dates, asks why only when needed, refuses done items", () => {
  const p = planned();
  const early = p.reschedule({ start: "2026-03-02", end: "2026-03-06" }, { today: "2026-02-20", reportUsesIt: false });
  assert.ok(early.ok);
  assert.deepEqual(early.value.change.plannedEnd, { from: "2026-03-05", to: "2026-03-06" });
  assert.equal(p.originalEnd, "2026-03-05");
  assert.equal(p.isMoved, true);
  const late = p.reschedule({ start: "2026-03-10", end: "2026-03-12" }, { today: TODAY, reportUsesIt: false });
  assert.equal(late.ok, false);
  assert.equal(late.error.details.field, "reason");
  assert.equal(p.reschedule({ start: "2026-03-10", end: "2026-03-12" }, { today: TODAY, reportUsesIt: false, reason: "Floods" }).value.reason, "Floods");
  assert.equal(p.applyStatus("COMPLETE", { at: new Date("2026-03-12T10:00:00Z") }).ok, true);
  assert.equal(p.completedOn, "2026-03-12");
  assert.equal(p.reschedule({ start: "2026-04-01", end: "2026-04-02" }, { today: TODAY, reportUsesIt: false, reason: "x" }).ok, false);
});

test("aggregate: cancel needs a reason; status follows the table", () => {
  const p = planned();
  assert.equal(p.applyStatus("REOPEN", { at: new Date() }).ok, false);
  assert.equal(p.applyStatus("CANCEL", { at: new Date() }).ok, false);
  const c = p.applyStatus("CANCEL", { at: new Date(), reason: " Funding cut " });
  assert.deepEqual(c.value, { change: { status: { from: "PLANNED", to: "CANCELLED" } }, reason: "Funding cut" });
  assert.equal(p.snapshot().statusReason, "Funding cut");
  assert.equal(p.applyStatus("RESTORE", { at: new Date() }).ok, true);
  assert.equal(p.snapshot().statusReason, undefined);
  assert.equal(p.snapshot().cancelledAt, undefined);
});

test("aggregate: details and lead changes are diffed; clearing a field removes it", () => {
  const p = planned({ location: "Ward 4", targetCount: 4 });
  const d = p.updateDetails({ location: undefined, description: "Door to door" }, { today: TODAY, reportUsesIt: false });
  assert.deepEqual(Object.keys(d.value.change).sort(), ["description", "location"]);
  assert.equal(p.snapshot().location, undefined);
  assert.equal(p.updateDetails({ targetCount: 5 }, { today: TODAY, reportUsesIt: false }).ok, false, "past original end: a changed target needs a reason");
  const a = p.assign({ ownerUserId: "u2", supportUserIds: [] });
  assert.deepEqual(a.value.change.ownerUserId, { from: null, to: "u2" });
  assert.deepEqual(p.assign({ ownerUserId: "u2", supportUserIds: [] }).value.change, {});
});

test("plan revisions: must change something; blank reasons are dropped", () => {
  const base = { id: "r", tenantId: "t", projectId: "p", plannedActivityId: "a", changedById: "u", changedAt: new Date() };
  assert.equal(createPlanRevision({ ...base, change: {} }).ok, false);
  const r = createPlanRevision({ ...base, change: { plannedEnd: { from: "a", to: "b" } }, reason: "  " });
  assert.equal("reason" in r.value, false);
});

test("work plan copy uses only the agreed words and no raw tokens", () => {
  for (const text of allWorkplanCopy()) {
    assert.deepEqual(findForbiddenWorkplanTerms(text), [], text);
    assert.deepEqual(findRawTokens(text), [], text);
  }
  assertExhaustive(PLAN_STATUS_LABEL, PLAN_STATUSES, "PLAN_STATUS_LABEL");
  assert.deepEqual(findForbiddenWorkplanTerms("Ask for a record"), ["record"]);
  assert.deepEqual(findForbiddenWorkplanTerms("Set the baseline"), ["baseline"]);
});

test("plain dates", () => {
  assert.equal(isPlainDate("2026-02-30"), false);
  assert.equal(isPlainDate("2028-02-29"), true);
  assert.equal(formatShortDate("2027-01-03", "2026-12-30"), "3 Jan 2027");
});

test("assertExhaustive names what is missing and extra", () => {
  assert.throws(() => assertExhaustive({ a: 1, c: 1 }, ["a", "b"], "T"), /missing \[b\], extra \[c\]/);
});

import { resolvePlanLink } from "../dist/index.js";
test("plan link: same project, same logframe activity, and the node is filled, never overwritten", () => {
  const plan = { id: "pa", projectId: "p", logframeActivityId: "n1" };
  assert.deepEqual(resolvePlanLink(plan, { projectId: "p" }).value, { plannedActivityId: "pa", logframeActivityId: "n1" });
  assert.deepEqual(resolvePlanLink(plan, { projectId: "p", logframeActivityId: "n1" }).value, { plannedActivityId: "pa", logframeActivityId: "n1" });
  assert.equal(resolvePlanLink(plan, { projectId: "p", logframeActivityId: "n2" }).ok, false);
  assert.equal(resolvePlanLink(plan, { projectId: "other" }).ok, false);
  assert.equal(resolvePlanLink(undefined, { projectId: "p" }).ok, false);
  assert.deepEqual(resolvePlanLink({ id: "pa", projectId: "p" }, { projectId: "p" }).value, { plannedActivityId: "pa" });
});

import { parseWorkPlanText, planWorkPlanCopy } from "../dist/index.js";

test("work plan text: a header row, then one activity per row; every problem names its row", () => {
  const ok = parseWorkPlanText("Logframe Code,Title,Start,End,Lead email,Location,Sessions,Repeats\nA1.1,Outreach,2026-03-10,2026-03-12,Amina@Org.org,Ward 4,4,Monthly\nA1.2,Training,2026-04-01,,,,,\n");
  assert.deepEqual(ok.problems, []);
  assert.deepEqual(ok.rows[0], { row: 1, logframeCode: "A1.1", title: "Outreach", start: "2026-03-10", end: "2026-03-12", leadEmail: "amina@org.org", location: "Ward 4", sessions: 4, repeats: "MONTH" });
  assert.equal(ok.rows[1].end, "2026-04-01", "no end date means one day (a milestone)");
  const bad = parseWorkPlanText("Title\tStart\tEnd\tSessions\tRepeats\n\t2026-03-10\t\t\t\nX\tnot a date\t\t\t\nY\t2026-03-10\t2026-03-01\t\t\nZ\t2026-03-10\t\t0\tyearly\n");
  assert.deepEqual(bad.problems, [
    "Row 1: give it a title.",
    "Row 2: start must be a date such as 2026-03-12.",
    "Row 3: end is before the start.",
    "Row 4: sessions must be a whole number of 1 or more; repeats must be No, Weekly or Monthly.",
  ]);
  assert.equal(parseWorkPlanText("").problems.length, 1);
  assert.match(parseWorkPlanText("Foo,Bar\n1,2").problems[0], /Title and Start/);
  assert.equal(parseWorkPlanText("Title,Start\nA,45376").problems.length, 1, "an Excel serial number is refused, not guessed");
});

test("copying a work plan keeps shape and offsets, never owners or statuses, and says what it left out", () => {
  const src = [
    { title: "A", description: "", plannedStart: "2026-01-10", plannedEnd: "2026-01-12", logframeActivityId: "old1", status: "DONE", targetCount: 4 },
    { title: "B", description: "", plannedStart: "2026-02-01", plannedEnd: "2026-02-03", status: "CANCELLED" },
    { title: "C", description: "", plannedStart: "2026-11-01", plannedEnd: "2026-11-30", status: "PLANNED" },
    { title: "D", description: "", plannedStart: "2026-06-01", plannedEnd: "2026-12-31", status: "PLANNED" },
  ];
  const out = planWorkPlanCopy(src, { start: "2026-01-01" }, { start: "2027-01-01", end: "2027-06-30" }, new Map([["old1", "new1"]]));
  assert.deepEqual(out.items.map((i) => [i.title, i.plannedStart, i.plannedEnd, i.logframeActivityId]), [["A", "2027-01-10", "2027-01-12", "new1"], ["D", "2027-06-01", "2027-06-30", undefined]]);
  assert.equal(out.items[0].targetCount, 4);
  assert.deepEqual(out.skipped, [{ title: "B", reason: "it was cancelled" }, { title: "C", reason: "it falls after the new project ends" }]);
  assert.ok(out.items.every((i) => !("ownerUserId" in i) && !("status" in i)));
});

import { suggestRequiredFiles, normalizeRequiredFiles, evidenceCoverage, MAX_REQUIRED_FILES } from "../dist/index.js";
test("files we will need: suggested from the activity's own words, never invented, never more than five", () => {
  assert.deepEqual(suggestRequiredFiles("Hygiene training for mothers"), ["ATTENDANCE_SHEET", "PHOTO"]);
  assert.deepEqual(suggestRequiredFiles("Outreach visits", "Mobile clinics"), ["ATTENDANCE_SHEET", "PHOTO"], "the logframe activity's words count too");
  assert.deepEqual(suggestRequiredFiles("Food distribution, Ward 4"), ["DISTRIBUTION_LIST", "PHOTO"]);
  assert.deepEqual(suggestRequiredFiles("Training and distribution day"), ["ATTENDANCE_SHEET", "PHOTO", "DISTRIBUTION_LIST"], "no repeats; the order is the table's");
  assert.deepEqual(suggestRequiredFiles("Procurement of pumps"), ["PROCUREMENT_DOCUMENT", "PHOTO"]);
  assert.deepEqual(suggestRequiredFiles("Quarterly review"), [], "nothing matches: nothing is asked for");
  assert.deepEqual(suggestRequiredFiles(undefined, null, ""), []);
  assert.ok(suggestRequiredFiles("training meeting distribution outreach monitoring survey procurement case study registration").length <= MAX_REQUIRED_FILES);
});

test("the stored list: known kinds only, no repeats, no 'Other', at most five", () => {
  assert.deepEqual(normalizeRequiredFiles(["PHOTO", "PHOTO", "ATTENDANCE_SHEET"]).value, ["PHOTO", "ATTENDANCE_SHEET"]);
  assert.deepEqual(normalizeRequiredFiles([]).value, []);
  assert.equal(normalizeRequiredFiles(["SELFIE"]).ok, false);
  assert.equal(normalizeRequiredFiles(["OTHER"]).ok, false);
  assert.equal(normalizeRequiredFiles(["PHOTO", "ATTENDANCE_SHEET", "DISTRIBUTION_LIST", "TRAINING_RECORD", "FIELD_VISIT_REPORT", "MEETING_MINUTES"]).error.details.field, "requiredFiles");
});

test("coverage: what has a file and what is still needed", () => {
  assert.deepEqual(evidenceCoverage(["ATTENDANCE_SHEET", "PHOTO"], ["PHOTO"]), { required: ["ATTENDANCE_SHEET", "PHOTO"], covered: ["PHOTO"], stillNeeded: ["ATTENDANCE_SHEET"] });
  assert.deepEqual(evidenceCoverage(["PHOTO"], new Set(["PHOTO", "OTHER"])).stillNeeded, []);
  assert.deepEqual(evidenceCoverage([], ["PHOTO"]), { required: [], covered: [], stillNeeded: [] });
});

test("a planned activity keeps its required files; changing them is a no-op when equal; a cancelled one cannot be edited", () => {
  const p = PlannedActivity.create({ id: "pa", tenantId: "tenant-a", projectId: "p", title: "Training", plannedStart: "2026-03-01", plannedEnd: "2026-03-02", requiredFiles: ["ATTENDANCE_SHEET"], createdById: "u" });
  assert.equal(p.ok, true);
  const item = p.value;
  assert.deepEqual(item.requiredFiles, ["ATTENDANCE_SHEET"]);
  assert.deepEqual(item.setRequiredFiles(["ATTENDANCE_SHEET"]).value.change, {});
  assert.deepEqual(item.setRequiredFiles(["ATTENDANCE_SHEET", "PHOTO"]).value.change, { requiredFiles: { from: ["ATTENDANCE_SHEET"], to: ["ATTENDANCE_SHEET", "PHOTO"] } });
  assert.equal(item.setRequiredFiles(["NOPE"]).ok, false);
  assert.deepEqual(item.requiredFiles, ["ATTENDANCE_SHEET", "PHOTO"], "a refused change is not kept");
  assert.equal(PlannedActivity.create({ id: "x", tenantId: "t", projectId: "p", title: "T", plannedStart: "2026-03-01", plannedEnd: "2026-03-01", requiredFiles: ["OTHER"], createdById: "u" }).ok, false);
  item.applyStatus("CANCEL", { at: new Date(), reason: "x" });
  assert.equal(item.setRequiredFiles(["PHOTO"]).ok, false);
});

test("plan link suggestions: the activity whose title the typed title repeats is offered before nearer ones", () => {
  const c = (id, title, extra) => ({ id, title, status: "PLANNED", plannedStart: "2026-03-01", plannedEnd: "2026-03-05", ...extra });
  const rows = [c("a", "Counsel caregivers"), c("b", "Deliver food to sites"), c("c", "Form support groups"), c("d", "Screen children by MUAC", { plannedStart: "2026-03-20", plannedEnd: "2026-03-25" })];
  assert.deepEqual(suggestPlanLinks({ userId: "u", date: "2026-03-02", title: "Screen children by MUAC, March 2026" }, rows).map((s) => s.id)[0], "d");
  assert.notEqual(suggestPlanLinks({ userId: "u", date: "2026-03-02" }, rows).map((s) => s.id)[0], "d");
  assert.notEqual(suggestPlanLinks({ userId: "u", date: "2026-03-02", title: "ab" }, rows).map((s) => s.id)[0], "d");
});

test("plan link suggestions: a person who leads many activities in the week can still reach another lead's activity by choosing its logframe activity", () => {
  const c = (id, node, owner) => ({ id, title: id, status: "PLANNED", plannedStart: "2026-03-01", plannedEnd: "2026-03-07", logframeActivityId: node, ownerUserId: owner });
  const rows = [c("a1", "n1", "ram"), c("a2", "n2", "ram"), c("a3", "n3", "ram"), c("a4", "n4", "bikash")];
  assert.equal(suggestPlanLinks({ userId: "ram", date: "2026-03-05", logframeActivityId: "n4" }, rows)[0].id, "a4");
  assert.equal(suggestPlanLinks({ userId: "ram", date: "2026-03-05" }, rows)[0].id, "a1");
});
