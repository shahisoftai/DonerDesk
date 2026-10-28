import test from "node:test";
import assert from "node:assert/strict";
import { TenantId } from "@donordesk/domain";
import { AskProjectHandler, UpdateAskSettingsHandler } from "../dist/index.js";

const tenantId = TenantId.create("tenant-a");
const ok = (value) => ({ ok: true, value });
const as = (userId, role = "PROJECT_MANAGER") => ({ tenant: { tenantId, userId, role }, requestId: "r" });
const manager = as("m"), field = as("f", "FIELD_OFFICER");
const now = new Date("2026-10-10T08:00:00Z");

function world(over = {}) {
  const events = [];
  const calls = { search: [], prompts: [] };
  const org = { askEnabled: true, aiEnabled: true, id: "o1", updateAskSettings(p) { this.askEnabled = p.enabled; } };
  const sheet = {
    projectId: "p1", finance: [{ secret: 1 }], periods: [{ id: "a", label: "Jan 2026", start: "2026-01-01", end: "2026-01-31" }],
    indicators: [{ id: "i1", code: "OUT-1", name: "Households receiving kits", type: "NUMBER", baseline: "0", target: "1,200" }],
    cells: [{ indicatorId: "i1", periodId: "a", periodValue: "170", cumulativeValue: "170", status: "VERIFIED" }],
  };
  const files = [
    { title: "Visit note", extractedText: "Contact Amina at amina@example.org about the 42 people who signed.", verificationStatus: "VERIFIED" },
  ];
  const h = new AskProjectHandler(
    { findByTenant: async () => ok(org) },
    { findById: async () => ok({ title: "WASH Gulu", projectCode: "WG-1", donorName: "ECHO", country: "Uganda", sector: "WASH", duration: { start: now, end: now }, description: undefined }) },
    { for: async () => ok(over.visible ?? [{ id: "p1" }]) },
    { handle: async () => ok(sheet) },
    { findByProject: async () => ok([
      { status: "ACCEPTED", activityTitle: "Hygiene session", activityDate: now, location: "Gulu", summary: "Handwashing.", participantsTotal: 42 },
      { status: "SUBMITTED", activityTitle: "Not yet accepted", activityDate: now, summary: "", participantsTotal: 9 },
    ]) },
    { search: async (filter) => (calls.search.push(filter), ok({ items: files, total: 1, page: 1, pageSize: 100 })) },
    { countRuns: async () => ok(over.runs ?? 0) },
    { record: async (e) => void events.push(e) },
    { now: () => now },
    async () => over.provider === null ? null : ({
      complete: async (input) => (calls.prompts.push(input), { text: over.reply ?? JSON.stringify({ answer: [{ text: "In January 170 households received kits (verified).", sources: ["S2"] }], missing: [] }), model: "m", promptVersion: "1", usage: { inputTokens: 1, outputTokens: 1 } }),
    }),
  );
  return { h, org, events, calls };
}

test("off until an administrator opts in; nothing is read or sent while it is off", async () => {
  const w = world();
  w.org.askEnabled = false;
  const r = await w.h.handle(manager, "p1", "How many households received kits?");
  assert.equal(r.value.available, false);
  assert.match(r.value.reason, /switched off/);
  assert.equal(w.calls.prompts.length, 0);
  assert.equal(w.calls.search.length, 0);
});

test("an answer is checked, cited, and audited without the question text", async () => {
  const w = world();
  const r = await w.h.handle(manager, "p1", "How many households received kits (OUT-1)?");
  assert.equal(r.value.available, true);
  assert.equal(r.value.status, "ANSWERED");
  assert.deepEqual(r.value.answer, ["In January 170 households received kits (verified)."]);
  assert.equal(r.value.sentences[0].sources[0].label, "Indicator OUT-1");
  assert.deepEqual(r.value.looked, { indicators: 1, activities: 1, evidence: 1 }, "only the accepted activity counts");
  const event = w.events.find((e) => e.eventType === "ask.question");
  assert.ok(event);
  assert.ok(!JSON.stringify(event).includes("households received kits (OUT-1)"), "the question text is not in the audit");
  assert.equal(JSON.parse(event.newValue).length, "How many households received kits (OUT-1)?".length);
});

test("a figure the model made up is dropped; with nothing left the answer says the records do not answer", async () => {
  const w = world({ reply: JSON.stringify({ answer: [{ text: "About 900 households received kits.", sources: ["S2"] }], missing: [] }) });
  const r = await w.h.handle(manager, "p1", "How many households received kits (OUT-1)?");
  assert.equal(r.value.status, "NOT_FOUND");
  assert.deepEqual(r.value.dropped, { uncited: 0, ungrounded: 1 });
  assert.match(r.value.missing[0], /do not answer/);
});

test("what goes to the model is redacted, finance is never in it, and unreadable evidence is not even fetched", async () => {
  const w = world();
  await w.h.handle(as("v", "VIEWER"), "p1", "Who signed the visit note in Gulu with 42 people?");
  const prompt = w.calls.prompts[0].userPrompt;
  assert.ok(!prompt.includes("amina@example.org"), "the e-mail address is redacted");
  assert.ok(!prompt.includes("secret"));
  assert.ok(w.calls.search[0].allowedConfidentialityLevels.every((l) => l === "PUBLIC" || l === "INTERNAL"), "a viewer is not offered restricted evidence");
  const m = world();
  await m.h.handle(manager, "p1", "anything about Gulu");
  assert.ok(m.calls.search[0].allowedConfidentialityLevels.includes("SENSITIVE"));
});

test("a project you cannot see, a question that is too short or long, and the cap on questions", async () => {
  assert.equal((await world({ visible: [] }).h.handle(manager, "p1", "How many?")).error.code, "NOT_FOUND");
  assert.match((await world().h.handle(manager, "p1", "hi")).error.message, /Write a question/);
  assert.match((await world().h.handle(manager, "p1", "x".repeat(501))).error.message, /under 500/);
  assert.equal((await world({ runs: 60 }).h.handle(manager, "p1", "How many households?")).error.code, "RATE_LIMITED");
  assert.equal((await world({ provider: null }).h.handle(manager, "p1", "How many households?")).value.available, false);
  assert.equal((await world().h.handle(as("v", "VIEWER"), "p1", "How many households?")).ok, true, "a viewer may ask about a project they can see");
});

test("only an administrator turns Ask on, and the change is audited", async () => {
  const events = [];
  const org = { id: "o1", askEnabled: false, updateAskSettings(p) { this.askEnabled = p.enabled; } };
  const update = new UpdateAskSettingsHandler({ findByTenant: async () => ok(org), update: async () => ok(org) }, { record: async (e) => void events.push(e) });
  assert.equal((await update.handle(manager, { enabled: true })).ok, false);
  assert.ok((await update.handle(as("admin", "ADMIN"), { enabled: true })).ok);
  assert.equal(org.askEnabled, true);
  assert.equal(events[0].eventType, "organization.ask_settings_updated");
});
