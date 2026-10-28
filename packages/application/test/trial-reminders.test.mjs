import test from "node:test";
import assert from "node:assert/strict";
import { TenantId } from "@donordesk/domain";
import { RunRemindersHandler, emailFingerprint, legacyEmailFingerprint, canonicalEmail } from "../dist/index.js";

const tenantId = TenantId.create("tenant-a");
const ok = (value) => ({ ok: true, value });
const ctx = { tenant: { tenantId, userId: "system", role: "ADMIN" }, requestId: "r" };

function run(nowIso, trialEnd, { sent = new Set() } = {}) {
  const sentMessages = [];
  const ledger = {
    wasSent: async (t, who, subject, rule) => ok(sent.has(`${who}|${subject}|${rule}`)),
    record: async (e) => (sent.add(`${e.recipientId}|${e.subjectKey}|${e.ruleKey}`), ok()),
  };
  const handler = new RunRemindersHandler(
    { list: async () => ok([]) }, ledger, { modes: async () => ok(new Map()) },
    { timeZone: async () => ok("UTC"), activeUsers: async () => ok([{ userId: "admin1", name: "A" }, { userId: "staff", name: "S" }]), projectManagers: async () => ok(new Map()) },
    { send: async (n) => void sentMessages.push(n) }, { record: async () => {} }, { now: () => new Date(nowIso) },
    undefined, undefined,
    { trialEnd: async () => ok(trialEnd), administrators: async () => ok(["admin1"]) },
  );
  return { handler, sentMessages, sent };
}

test("administrators hear about the trial ending once each, in the organisation's morning run; staff do not", async () => {
  const end = new Date("2026-10-20T08:00:00Z");
  const w = run("2026-10-18T07:10:00Z", end);
  const first = await w.handler.handle(ctx);
  assert.equal(first.value.trialNoticesSent, 1);
  assert.deepEqual(w.sentMessages.map((m) => [m.recipientId, m.urgent]), [["admin1", true]]);
  assert.match(w.sentMessages[0].title, /ends in 2 days/);
  // The same hour again: the ledger remembers.
  const second = run("2026-10-18T07:40:00Z", end, { sent: w.sent });
  assert.equal((await second.handler.handle(ctx)).value.trialNoticesSent, 0);
  // Next notice, on the last morning (a day before is still the three-day notice's time, so it is not repeated).
  const day1 = run("2026-10-19T07:05:00Z", end, { sent: w.sent });
  await day1.handler.handle(ctx);
  assert.equal(day1.sentMessages.length, 0);
  const third = run("2026-10-20T07:05:00Z", end, { sent: w.sent });
  await third.handler.handle(ctx);
  assert.match(third.sentMessages[0].title, /within a day/);
  // After it ended.
  const after = run("2026-10-21T07:05:00Z", end, { sent: w.sent });
  await after.handler.handle(ctx);
  assert.match(after.sentMessages[0].title, /has ended/);
});

test("no trial, or not the morning hour, sends nothing", async () => {
  const none = run("2026-10-18T07:10:00Z", null);
  assert.equal((await none.handler.handle(ctx)).value.trialNoticesSent, 0);
  const night = run("2026-10-18T15:10:00Z", new Date("2026-10-20T08:00:00Z"));
  assert.equal((await night.handler.handle(ctx)).value.ran, false);
  assert.equal(night.sentMessages.length, 0);
});

test("a trial cannot be started again under an alias of the same mailbox, and trials recorded the old way still count", () => {
  assert.equal(canonicalEmail("Jane.Doe+trial2@Gmail.com"), "janedoe@gmail.com");
  assert.equal(canonicalEmail("jane.doe@googlemail.com"), "janedoe@gmail.com");
  assert.equal(canonicalEmail("jane.doe+ngo@charity.org"), "jane.doe@charity.org", "dots count outside Gmail");
  assert.equal(canonicalEmail("  A@B.org "), "a@b.org");
  assert.equal(emailFingerprint("j.doe+1@gmail.com"), emailFingerprint("jdoe@gmail.com"));
  assert.notEqual(emailFingerprint("jane@charity.org"), emailFingerprint("john@charity.org"));
  assert.equal(legacyEmailFingerprint("Jane@Charity.org "), legacyEmailFingerprint("jane@charity.org"));
  assert.equal(legacyEmailFingerprint("jane@charity.org"), emailFingerprint("jane@charity.org"), "a plain address has the same fingerprint either way");
});
