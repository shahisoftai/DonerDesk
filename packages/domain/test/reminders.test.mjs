import test from "node:test";
import assert from "node:assert/strict";
import {
  assertExhaustive, ASSIGNMENT_KIND_KEYS, REMINDER_RULES, summaryRuleOf, shouldEscalate, daysLate, reminderText, SOON_DAYS, ESCALATE_AFTER_DAYS,
  summaryLines, applyMode, renderSummary, planEscalations, isSendHour, localDate, isSummaryMode, SUMMARY_MODES, findRawTokens,
} from "../dist/index.js";

const TODAY = "2026-03-10";
const a = (key, extra = {}) => ({ key, kind: "TASK", projectId: "p", projectTitle: "Clinics", title: key, assigneeId: "u1", state: "OPEN", urgent: false, href: "/projects/p", urgency: 5, ...extra });

test("every assignment kind has a reminder row, and role-based or undated kinds never remind", () => {
  assertExhaustive(REMINDER_RULES, ASSIGNMENT_KIND_KEYS, "REMINDER_RULES");
  for (const kind of ["EVIDENCE_REVIEW", "ACTIVITY_REVIEW", "ACTIVITY_FIX"]) assert.deepEqual(REMINDER_RULES[kind], [], kind);
  assert.equal(SOON_DAYS, 3);
  assert.equal(ESCALATE_AFTER_DAYS, 7);
});

test("which rule puts something in today's summary", () => {
  assert.equal(summaryRuleOf(a("x", { dueDate: "2026-03-01", state: "LATE" }), TODAY), "LATE");
  assert.equal(summaryRuleOf(a("x", { dueDate: "2026-03-20", state: "LATE" }), TODAY), "LATE", "a late start is late before its end date");
  assert.equal(summaryRuleOf(a("x", { dueDate: TODAY }), TODAY), "DUE_TODAY");
  assert.equal(summaryRuleOf(a("x", { dueDate: "2026-03-11" }), TODAY), "DUE_SOON");
  assert.equal(summaryRuleOf(a("x", { dueDate: "2026-03-13" }), TODAY), "DUE_SOON", "three days out");
  assert.equal(summaryRuleOf(a("x", { dueDate: "2026-03-14" }), TODAY), undefined, "four days out is not yet");
  assert.equal(summaryRuleOf(a("x"), TODAY), undefined, "no date, no reminder");
  assert.equal(summaryRuleOf(a("x", { kind: "ACTIVITY_REVIEW", dueDate: "2026-03-01", state: "LATE" }), TODAY), undefined, "a role-based review never reminds");
});

test("escalation: a week late, once, only for kinds that escalate", () => {
  assert.equal(daysLate({ dueDate: "2026-03-01" }, TODAY), 9);
  assert.equal(daysLate({ dueDate: TODAY }, TODAY), 0);
  assert.equal(daysLate({}, TODAY), 0);
  assert.equal(shouldEscalate(a("x", { dueDate: "2026-03-03", state: "LATE" }), TODAY), true, "exactly 7 days");
  assert.equal(shouldEscalate(a("x", { dueDate: "2026-03-04", state: "LATE" }), TODAY), false, "6 days");
  assert.equal(shouldEscalate(a("x", { dueDate: "2026-03-01", state: "OPEN" }), TODAY), false);
  assert.equal(shouldEscalate(a("x", { kind: "ACTIVITY_FIX", dueDate: "2026-03-01", state: "LATE" }), TODAY), false);
});

test("lines come most pressing first, in words, and a quiet day plans nothing", () => {
  const lines = summaryLines([
    a("soon", { dueDate: "2026-03-12" }), a("today", { dueDate: TODAY }), a("late-b", { dueDate: "2026-03-05", state: "LATE" }), a("late-a", { dueDate: "2026-03-01", state: "LATE" }), a("none"), a("far", { dueDate: "2026-04-01" }),
  ], TODAY);
  assert.deepEqual(lines.map((l) => [l.key, l.rule]), [["late-a", "LATE"], ["late-b", "LATE"], ["today", "DUE_TODAY"], ["soon", "DUE_SOON"]]);
  assert.equal(lines[0].text, "late-a (Clinics): was due 1 Mar");
  assert.equal(lines[2].text, "today (Clinics): due today");
  assert.equal(lines[3].text, "soon (Clinics): due 12 Mar");
  assert.deepEqual(summaryLines([], TODAY), []);
  assert.equal(renderSummary([]), null);
});

test("modes: daily summary keeps everything, only-urgent keeps late, today and urgent, never keeps nothing", () => {
  const lines = summaryLines([a("soon", { dueDate: "2026-03-12" }), a("soon-urgent", { dueDate: "2026-03-12", urgent: true }), a("today", { dueDate: TODAY }), a("late", { dueDate: "2026-03-01", state: "LATE" })], TODAY);
  assert.equal(applyMode(lines, "DAILY_SUMMARY").length, 4);
  assert.deepEqual(applyMode(lines, "URGENT_ONLY").map((l) => l.key).sort(), ["late", "soon-urgent", "today"]);
  assert.deepEqual(applyMode(lines, "NEVER"), []);
  assert.deepEqual(SUMMARY_MODES, ["DAILY_SUMMARY", "URGENT_ONLY", "NEVER"]);
  assert.equal(isSummaryMode("NEVER"), true);
  assert.equal(isSummaryMode("sometimes"), false);
});

test("the summary reads as plain sentences with no code or id", () => {
  const out = renderSummary(summaryLines([a("Send the form", { dueDate: TODAY }), a("Report", { kind: "REPORT_DEADLINE", dueDate: "2026-03-01", state: "LATE" }), a("Visit", { dueDate: "2026-03-12" })], TODAY));
  assert.equal(out.title, "3 things need you today (1 late, 1 due today)");
  assert.equal(out.message, ["Late", "- Report (Clinics): was due 1 Mar", "Due today", "- Send the form (Clinics): due today", "Coming up", "- Visit (Clinics): due 12 Mar"].join("\n"));
  assert.deepEqual(findRawTokens(out.title), []);
  assert.equal(renderSummary(summaryLines([a("Only", { dueDate: TODAY })], TODAY)).title, "1 thing needs you today (1 due today)");
});

test("escalation goes to the project manager once, never to the person who is late or when nobody manages", () => {
  const items = [
    a("t1", { assigneeId: "amina", dueDate: "2026-03-01", state: "LATE" }),
    a("t2", { assigneeId: "mgr", dueDate: "2026-03-01", state: "LATE" }),
    a("t3", { assigneeId: "amina", dueDate: "2026-03-08", state: "LATE" }),
    a("t4", { assigneeId: "amina", projectId: "orphan", dueDate: "2026-03-01", state: "LATE" }),
  ];
  const managers = { p: "mgr" };
  const names = { amina: "Amina", mgr: "Joe" };
  const out = planEscalations(items, TODAY, (p) => managers[p], (id) => names[id], () => false);
  assert.deepEqual(out.map((e) => [e.recipientId, e.subjectKey, e.title]), [["mgr", "t1", "Amina is 9 days late"]]);
  assert.equal(out[0].message, "t1 (Clinics) was due 2026-03-01. Amina is responsible for it.");
  assert.deepEqual(planEscalations(items, TODAY, (p) => managers[p], (id) => names[id], (r, k) => k === "t1"), [], "already told");
});

test("the summary goes out in the 07:00 hour of the organisation's own day", () => {
  const instant = new Date("2026-03-10T07:30:00Z");
  assert.equal(isSendHour(instant, "UTC"), true);
  assert.equal(isSendHour(new Date("2026-03-10T06:59:00Z"), "UTC"), false);
  assert.equal(isSendHour(new Date("2026-03-10T08:00:00Z"), "UTC"), false);
  assert.equal(isSendHour(new Date("2026-03-10T02:15:00Z"), "Asia/Karachi"), true, "07:15 in Karachi (UTC+5)");
  assert.equal(isSendHour(new Date("2026-03-10T12:15:00Z"), "America/New_York"), false, "08:15 EDT: summer time has begun");
  assert.equal(isSendHour(new Date("2026-03-10T11:15:00Z"), "America/New_York"), true, "07:15 EDT");
  assert.equal(isSendHour(new Date("2026-02-10T12:15:00Z"), "America/New_York"), true, "07:15 EST in winter: the zone rules are followed, not a fixed offset");
  assert.equal(localDate(new Date("2026-03-10T22:30:00Z"), "Asia/Karachi"), "2026-03-11", "already tomorrow in Karachi");
  assert.equal(localDate(new Date("2026-03-10T22:30:00Z"), "UTC"), "2026-03-10");
  assert.equal(isValidTimeZone("Asia/Karachi"), true);
  assert.equal(isValidTimeZone("Mars/Base"), false);
  assert.equal(localDate(new Date("2026-03-10T22:30:00Z"), "Mars/Base"), "2026-03-10", "an unknown zone reads as UTC");
});

import { suggestTimeZone, Organization, TenantId, isValidTimeZone } from "../dist/index.js";
test("a new organisation's time zone is suggested from its country; unknown stays UTC; a bad zone is refused", () => {
  assert.equal(suggestTimeZone("Kenya"), "Africa/Nairobi");
  assert.equal(suggestTimeZone("KE"), "Africa/Nairobi");
  assert.equal(suggestTimeZone("  pakistan "), "Asia/Karachi");
  assert.equal(suggestTimeZone("United States"), "UTC", "several zones: no guess");
  assert.equal(suggestTimeZone(""), "UTC");
  for (const zone of new Set(["Kenya", "Nigeria", "Ghana", "Pakistan", "Jordan", "Ukraine", "Haiti", "Vietnam", "UK"].map(suggestTimeZone))) assert.equal(isValidTimeZone(zone), true, zone);
  const props = (extra = {}) => ({ name: "Org", organizationType: "NGO", country: "Kenya", sectors: ["HEALTH"], contactName: "C", contactEmail: "c@x.org", defaultLanguage: "en", dataResidency: "DEFAULT", aiEnabled: true, storageProvider: "LOCAL", reportingDefaults: Organization.defaultReportingDefaults(), agentMemoryEnabled: false, ...extra });
  const org = Organization.create({ id: "o1", tenantId: TenantId.create("tenant-a"), props: props() });
  assert.equal(org.timeZone, "Africa/Nairobi", "suggested from the country");
  assert.equal(Organization.create({ id: "o2", tenantId: TenantId.create("tenant-b"), props: props({ timeZone: "Europe/London" }) }).timeZone, "Europe/London", "an explicit zone wins");
  org.updateProfile({ timeZone: "Asia/Karachi" });
  assert.equal(org.timeZone, "Asia/Karachi");
  assert.throws(() => org.updateProfile({ timeZone: "Mars/Base" }), /time zone/i);
  assert.equal(org.timeZone, "Asia/Karachi", "an invalid change is not kept");
});
