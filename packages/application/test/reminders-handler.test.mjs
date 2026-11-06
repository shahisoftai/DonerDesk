import test from "node:test";
import assert from "node:assert/strict";
import { TenantId } from "@donordesk/domain";
import { RunRemindersHandler, GetNotificationPreferencesHandler, UpdateNotificationPreferencesHandler, PersonNotifier } from "../dist/index.js";

const tenantId = TenantId.create("tenant-a");
const SYSTEM = { tenant: { tenantId, userId: "system:reminders", role: "ADMIN" }, requestId: "r" };
const ok = (value) => ({ ok: true, value });
const A = (key, assigneeId, extra = {}) => ({ key, kind: "TASK", projectId: "p", projectTitle: "Clinics", title: key, assigneeId, state: "OPEN", urgent: false, href: "/projects/p", urgency: 5, ...extra });

function world({ at = "2026-03-10T07:10:00Z", zone = "UTC", modes = {}, lists = {}, managers = { p: "mgr" } } = {}) {
  const sent = [];
  const ledger = [];
  const audit = [];
  const queueCalls = [];
  const handler = new RunRemindersHandler(
    { list: async (q) => (queueCalls.push(q.assigneeId), ok(lists[q.assigneeId] ?? [])) },
    {
      wasSent: async (_t, recipient, subject, rule, on) => ok(ledger.some((l) => l.recipientId === recipient && l.subjectKey === subject && l.ruleKey === rule && (on === undefined || l.sentOn === on))),
      record: async (e) => (ledger.some((l) => l.recipientId === e.recipientId && l.subjectKey === e.subjectKey && l.ruleKey === e.ruleKey && l.sentOn === e.sentOn) || ledger.push(e), ok(undefined)),
    },
    { modes: async (_t, ids) => ok(new Map(ids.map((id) => [id, modes[id] ?? "DAILY_SUMMARY"]))), get: async () => ok("DAILY_SUMMARY"), set: async () => ok(undefined) },
    { timeZone: async () => ok(zone), activeUsers: async () => ok([{ userId: "amina", name: "Amina" }, { userId: "joe", name: "Joe" }, { userId: "mgr", name: "Pat" }]), projectManagers: async () => ok(new Map(Object.entries(managers))) },
    { send: async (n) => void sent.push(n) },
    { record: async (e) => void audit.push(e) },
    { now: () => new Date(at) },
  );
  return { handler, sent, ledger, audit, queueCalls };
}

const busy = { amina: [A("Send the form", "amina", { dueDate: "2026-03-10" }), A("Visit", "amina", { dueDate: "2026-03-06", state: "LATE" })], joe: [A("Soon", "joe", { dueDate: "2026-03-12" })] };

test("it does nothing outside the organisation's 07:00 hour, unless forced", async () => {
  const w = world({ at: "2026-03-10T12:00:00Z", lists: busy });
  assert.deepEqual((await w.handler.handle(SYSTEM)).value, { ran: false, summariesSent: 0, quiet: 0, escalationsSent: 0 });
  assert.deepEqual(w.queueCalls, [], "it did not even look");
  assert.equal(w.sent.length, 0);
  assert.equal((await w.handler.handle(SYSTEM, { force: true })).value.ran, true);
});

test("one summary per person, in words; a quiet day sends nothing to that person", async () => {
  const w = world({ lists: busy });
  const out = await w.handler.handle(SYSTEM);
  assert.deepEqual(out.value, { ran: true, summariesSent: 2, quiet: 1, escalationsSent: 0 });
  const amina = w.sent.find((s) => s.recipientId === "amina");
  assert.equal(amina.title, "2 things need you today (1 late, 1 due today)");
  assert.equal(amina.type, "DEADLINE_REMINDER");
  assert.equal(amina.urgent, true, "a late item makes the summary urgent");
  assert.equal(w.sent.find((s) => s.recipientId === "joe").urgent, false);
  assert.equal(w.sent.some((s) => s.recipientId === "mgr"), false, "nothing for mgr");
  assert.equal(w.audit.at(-1).eventType, "reminders.sent");
});

test("the hourly timer never sends the same summary twice in a day, but does on the next day", async () => {
  const w = world({ lists: busy });
  await w.handler.handle(SYSTEM);
  const again = await w.handler.handle(SYSTEM);
  assert.equal(again.value.summariesSent, 0);
  assert.equal(w.sent.length, 2);
  assert.equal(w.ledger.filter((l) => l.ruleKey === "DAILY_SUMMARY").length, 2);
  const tomorrow = world({ at: "2026-03-11T07:10:00Z", lists: busy });
  tomorrow.ledger.push({ recipientId: "amina", subjectKey: "summary", ruleKey: "DAILY_SUMMARY", sentOn: "2026-03-10" });
  assert.equal((await tomorrow.handler.handle(SYSTEM)).value.summariesSent, 2, "yesterday's entry does not block today");
});

test("the person's setting decides what they are told: only urgent keeps late and urgent; never sends nothing", async () => {
  const w = world({ modes: { amina: "URGENT_ONLY", joe: "NEVER" }, lists: busy });
  const out = await w.handler.handle(SYSTEM);
  assert.equal(out.value.summariesSent, 1);
  assert.match(w.sent[0].message, /Visit/);
  assert.match(w.sent[0].message, /Send the form/, "due today counts as urgent for this mode");
  assert.equal(w.sent.some((s) => s.recipientId === "joe"), false);
  assert.equal(out.value.quiet, 2, "joe (never) and mgr (nothing)");
});

test("work a week late is told once to the project manager, never to the person, and not again", async () => {
  const late = { amina: [A("Old task", "amina", { dueDate: "2026-03-01", state: "LATE" })] };
  const w = world({ lists: late });
  const first = await w.handler.handle(SYSTEM);
  assert.equal(first.value.escalationsSent, 1);
  const esc = w.sent.find((s) => s.recipientId === "mgr");
  assert.equal(esc.title, "Amina is 9 days late");
  assert.equal(esc.urgent, true);
  assert.equal(w.sent.filter((s) => s.recipientId === "amina").length, 1, "the person gets their own summary, not the escalation");
  const second = await w.handler.handle(SYSTEM, { force: true });
  assert.equal(second.value.escalationsSent, 0, "told once, ever");
  const nextDay = world({ at: "2026-03-11T07:10:00Z", lists: late });
  nextDay.ledger.push(...w.ledger);
  assert.equal((await nextDay.handler.handle(SYSTEM)).value.escalationsSent, 0, "and not the next day either");
});

test("no manager, or the manager is the one who is late: nobody is escalated to", async () => {
  const orphan = world({ lists: { amina: [A("Old", "amina", { dueDate: "2026-03-01", state: "LATE" })] }, managers: {} });
  assert.equal((await orphan.handler.handle(SYSTEM)).value.escalationsSent, 0);
  const self = world({ lists: { mgr: [A("Mine", "mgr", { dueDate: "2026-03-01", state: "LATE" })] } });
  assert.equal((await self.handler.handle(SYSTEM)).value.escalationsSent, 0);
});

test("the day is the organisation's own: 07:10 in Karachi is 02:10 UTC", async () => {
  const w = world({ at: "2026-03-10T02:10:00Z", zone: "Asia/Karachi", lists: busy });
  assert.equal((await w.handler.handle(SYSTEM)).value.ran, true);
  const utcHour = world({ at: "2026-03-10T07:10:00Z", zone: "Asia/Karachi", lists: busy });
  assert.equal((await utcHour.handler.handle(SYSTEM)).value.ran, false, "12:10 in Karachi is not the send hour");
});

test("a failing source stops the run rather than sending a wrong summary", async () => {
  const handler = new RunRemindersHandler(
    { list: async () => ({ ok: false, error: new Error("db down") }) }, { wasSent: async () => ok(false), record: async () => ok(undefined) },
    { modes: async () => ok(new Map()) },
    { timeZone: async () => ok("UTC"), activeUsers: async () => ok([{ userId: "amina", name: "Amina" }]), projectManagers: async () => ok(new Map()) },
    { send: async () => { throw new Error("should not send"); } }, { record: async () => undefined }, { now: () => new Date("2026-03-10T07:10:00Z") },
  );
  assert.equal((await handler.handle(SYSTEM)).ok, false);
});

test("the preference: read, change (audited once), refuse anything else", async () => {
  let mode = "DAILY_SUMMARY";
  const audit = [];
  const prefs = { get: async () => ok(mode), set: async (_t, _u, m) => ((mode = m), ok(undefined)), modes: async () => ok(new Map()) };
  const get = new GetNotificationPreferencesHandler(prefs);
  const update = new UpdateNotificationPreferencesHandler(prefs, { record: async (e) => void audit.push(e) });
  const me = { tenant: { tenantId, userId: "u1", role: "FIELD_OFFICER" }, requestId: "r" };
  assert.deepEqual((await get.handle(me)).value, { emailSummaryMode: "DAILY_SUMMARY" });
  assert.equal((await update.handle(me, { emailSummaryMode: "sometimes" })).error.details.field, "emailSummaryMode");
  assert.equal((await update.handle(me, { emailSummaryMode: "URGENT_ONLY" })).ok, true);
  assert.equal((await update.handle(me, { emailSummaryMode: "URGENT_ONLY" })).ok, true);
  assert.equal(audit.length, 1, "no change, no audit event");
  assert.deepEqual([audit[0].oldValue, audit[0].newValue], ["DAILY_SUMMARY", "URGENT_ONLY"]);
});

test("telling a person: always an in-app note; email only when their setting allows", async () => {
  const rows = [];
  const mails = [];
  const make = (mode) => new PersonNotifier({ generate: () => `n${rows.length + 1}` }, { create: async (r) => (rows.push(r), ok(undefined)) }, { notify: async (m) => void mails.push(m) }, { get: async () => ok(mode), set: async () => ok(undefined), modes: async () => ok(new Map()) });
  const n = { tenantId, recipientId: "u2", type: "ASSIGNMENT", title: "New request", message: "Add a file", urgent: false };
  await make("DAILY_SUMMARY").send(n);
  await make("URGENT_ONLY").send(n);
  await make("URGENT_ONLY").send({ ...n, urgent: true });
  await make("NEVER").send({ ...n, urgent: true });
  assert.equal(rows.length, 4, "an in-app note every time");
  assert.equal(mails.length, 2, "daily summary people, and urgent for 'only urgent'; never for 'never'");
  const failing = new PersonNotifier({ generate: () => "x" }, { create: async () => { throw new Error("db"); } }, { notify: async () => undefined }, { get: async () => ok("DAILY_SUMMARY") });
  await assert.doesNotReject(() => failing.send(n), "telling someone never fails the caller");
});
