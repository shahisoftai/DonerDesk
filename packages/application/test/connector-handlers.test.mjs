import test from "node:test";
import assert from "node:assert/strict";
import { TenantId } from "@donordesk/domain";
import { SaveConnectorHandler, SyncConnectorHandler, ListConnectorsHandler, DeleteConnectorHandler } from "../dist/index.js";

const tenantId = TenantId.create("tenant-a");
const ok = (value) => ({ ok: true, value });
const as = (userId, role = "PROJECT_MANAGER") => ({ tenant: { tenantId, userId, role }, requestId: "r" });
const manager = as("m"), viewer = as("v", "VIEWER");
const clock = { now: () => new Date("2026-10-10T08:00:00Z") };
let n = 0;
const ids = { generate: () => `c${++n}` };
const audit = { events: [], record: async function (e) { this.events.push(e); } };

const form = {
  id: "f1", tenantId, projectId: "p1", status: "PUBLISHED",
  definition: { fields: [{ key: "day", label: "Day", type: "DATE", required: true }, { key: "kits", label: "Kits", type: "NUMBER", required: true, min: 0 }] },
};
const secrets = { available: true, encrypt: (p) => `enc(${p})`, decrypt: (s) => s.slice(4, -1) };

function world(over = {}) {
  const store = new Map(), records = new Map();
  const calls = [];
  return {
    store, records, calls,
    forms: { findById: async () => ok(over.form ?? form) },
    repo: {
      create: async (c) => (store.set(c.id, c), ok()), update: async (c) => (store.set(c.id, c), ok()), delete: async (id) => (store.delete(id), ok()),
      findById: async (id) => ok(store.get(id) ?? null), listByForm: async () => ok([...store.values()]),
    },
    recordsRepo: {
      createOnce: async (r) => (records.has(r.id) ? ok({ record: records.get(r.id), created: false }) : (records.set(r.id, r), ok({ record: r, created: true }))),
      findById: async (id) => ok(records.get(id) ?? null),
    },
    http: { get: async (url, headers) => (calls.push([url, headers]), over.http ? over.http(url) : { ok: true, json: { results: [] } }) },
  };
}

const input = { name: "Field survey", kind: "KOBOTOOLBOX", serverUrl: "https://kf.kobotoolbox.org", sourceId: "aBcD1234", credential: "secret-token", fieldMap: [{ sourceField: "visit_date", formKey: "day" }, { sourceField: "kits", formKey: "kits" }] };
const sub = (id, at, values) => ({ _uuid: id, _submission_time: at, ...values });

test("saving: a key is kept encrypted and never returned; nothing is saved where no secret key is set up; the form's own rules decide the mapping", async () => {
  const w = world();
  const save = new SaveConnectorHandler(ids, w.forms, w.repo, secrets, audit, clock);
  assert.equal((await save.handle(viewer, "f1", input)).error.code, "FORBIDDEN");
  assert.match((await new SaveConnectorHandler(ids, w.forms, w.repo, { ...secrets, available: false }, audit, clock).handle(manager, "f1", input)).error.message, /not set up on this server/);
  assert.match((await save.handle(manager, "f1", { ...input, credential: undefined })).error.message, /key the other tool issued/);
  assert.match((await save.handle(manager, "f1", { ...input, fieldMap: [input.fieldMap[0]] })).error.message, /"Kits" is required/);
  const created = await save.handle(manager, "f1", input);
  assert.ok(created.ok);
  assert.equal(w.store.get(created.value.id).credentialEnc, "enc(secret-token)");
  const listed = await new ListConnectorsHandler(w.repo, secrets).handle(manager, "f1");
  assert.equal(listed.value.connectors[0].hasCredential, true);
  assert.ok(!JSON.stringify(listed.value).includes("secret-token") && !JSON.stringify(listed.value).includes("enc("), "the key never leaves");
  assert.ok(!JSON.stringify(audit.events).includes("secret-token"));
  // Editing without a key keeps the saved one; pointing at another survey starts over.
  w.store.get(created.value.id).cursor = "2026-10-01T00:00:00.000Z";
  await save.handle(manager, "f1", { ...input, credential: undefined, name: "Renamed" }, created.value.id);
  assert.equal(w.store.get(created.value.id).credentialEnc, "enc(secret-token)");
  assert.equal(w.store.get(created.value.id).cursor, "2026-10-01T00:00:00.000Z");
  await save.handle(manager, "f1", { ...input, credential: undefined, sourceId: "otherSurvey" }, created.value.id);
  assert.equal(w.store.get(created.value.id).cursor, undefined, "a different survey is read from the beginning");
});

async function connectorIn(w) {
  const save = new SaveConnectorHandler(ids, w.forms, w.repo, secrets, audit, clock);
  return (await save.handle(manager, "f1", input)).value.id;
}
const syncer = (w) => new SyncConnectorHandler(w.forms, w.recordsRepo, w.repo, secrets, w.http, audit, clock);

test("a check reads and reports but stores nothing and moves nothing; a sync stores records waiting for review, once each", async () => {
  const w = world({ http: () => ({ ok: true, json: { results: [sub("u1", "2026-10-03T08:00:00", { visit_date: "2026-10-02", kits: "5" }), sub("u2", "2026-10-04T08:00:00", { visit_date: "2026-10-03", kits: "7" })] } }) });
  const id = await connectorIn(w);
  const sync = syncer(w);
  const check = await sync.handle(manager, id, { apply: false });
  assert.deepEqual([check.value.read, check.value.created, check.value.applied], [2, 2, false]);
  assert.equal(w.records.size, 0);
  assert.equal(w.store.get(id).cursor, undefined);
  assert.equal(w.calls[0][1].authorization, "Token secret-token", "the decrypted key goes in the header only");
  assert.ok(!w.calls[0][0].includes("secret-token"));

  const done = await sync.handle(manager, id, { apply: true });
  assert.deepEqual([done.value.created, done.value.alreadyHad, done.value.rejected], [2, 0, 0]);
  const stored = [...w.records.values()][0];
  assert.deepEqual([stored.status, stored.source, stored.answers], ["PENDING", "CONNECTOR", { day: "2026-10-02", kits: 5 }]);
  assert.match(stored.submitterName, /KoboToolbox: Field survey/);
  assert.equal(w.store.get(id).cursor, "2026-10-04T08:00:00.000Z");
  const again = await sync.handle(manager, id, { apply: true });
  assert.deepEqual([again.value.created, again.value.alreadyHad], [0, 2], "the same submissions are not stored twice");
  assert.equal(w.records.size, 2);
  assert.equal(audit.events.at(-1).eventType, "connector.synced");
});

test("a submission the form refuses is reported and left behind: the cursor stops before it, so fixing the mapping brings it in", async () => {
  const w = world({ http: () => ({ ok: true, json: { results: [
    sub("u1", "2026-10-03T08:00:00", { visit_date: "2026-10-02", kits: "5" }),
    sub("u2", "2026-10-04T08:00:00", { visit_date: "not a date", kits: "7" }),
    sub("u3", "2026-10-05T08:00:00", { visit_date: "2026-10-04", kits: "9" }),
  ] } }) });
  const id = await connectorIn(w);
  const r = await syncer(w).handle(manager, id, { apply: true });
  assert.deepEqual([r.value.created, r.value.rejected], [2, 1]);
  assert.match(r.value.problems[0], /Submission u2/);
  assert.equal(w.store.get(id).cursor, "2026-10-03T08:00:00.000Z", "stops before the refused row");
});

test("the other tool's refusals are said plainly and a failed sync is noted without moving anything", async () => {
  for (const [reason, re] of [["UNAUTHORIZED", /refused the key/], ["NOT_FOUND", /does not know that form/], ["UNSAFE_ADDRESS", /private network/], ["TIMEOUT", /did not answer/]]) {
    const w = world({ http: () => ({ ok: false, reason }) });
    const id = await connectorIn(w);
    const r = await syncer(w).handle(manager, id, { apply: true });
    assert.match(r.error.message, re);
    assert.match(w.store.get(id).lastSync.error, re);
    assert.equal(w.records.size, 0);
  }
});

test("pages are followed up to a limit; an unpublished form takes no records; a viewer cannot sync; delete keeps the records", async () => {
  let page = 0;
  const w = world({ http: () => ({ ok: true, json: { next: "more", results: [sub(`u${++page}`, `2026-10-0${page}T08:00:00`, { visit_date: "2026-10-02", kits: "1" })] } }) });
  const id = await connectorIn(w);
  const r = await syncer(w).handle(manager, id, { apply: true });
  assert.equal(r.value.read, 5);
  assert.equal(r.value.more, true);
  assert.equal(w.calls.length, 5);
  assert.match(w.calls[1][0], /start=1/);
  assert.equal((await syncer(w).handle(viewer, id, { apply: true })).error.code, "FORBIDDEN");
  const draft = world({ form: { ...form, status: "DRAFT" } });
  const did = await connectorIn(draft);
  assert.match((await syncer(draft).handle(manager, did, { apply: true })).error.message, /Publish the form/);
  assert.equal((await syncer(draft).handle(manager, did, { apply: false })).ok, true, "a check works on a draft");
  await new DeleteConnectorHandler(w.repo, audit).handle(manager, id);
  assert.equal(w.store.size, 0);
  assert.equal(w.records.size, 5);
});
