import test from "node:test";
import assert from "node:assert/strict";
import { TenantId, hashApiToken } from "@donordesk/domain";
import {
  CreateApiKeyHandler, ListApiKeysHandler, RevokeApiKeyHandler, ApiKeyAuthenticator, CreateWebhookEndpointHandler, ListWebhookEndpointsHandler, UpdateWebhookEndpointHandler,
  DeleteWebhookEndpointHandler, ListWebhookDeliveriesHandler, WebhookDispatcher, ListApiProjectsHandler,
} from "../dist/index.js";

const tenantId = TenantId.create("tenant-a");
const ctxFor = (userId, role) => ({ tenant: { tenantId, userId, role }, requestId: "r" });
const ADMIN = ctxFor("admin", "ADMIN");
const PM = ctxFor("pm", "PROJECT_MANAGER");
const ok = (value) => ({ ok: true, value });
let now = new Date("2026-10-28T10:00:00Z");
const clock = { now: () => now };
let n = 0;
const ids = { generate: () => `id${++n}` };
const rnd = (len) => Buffer.alloc(len, 9);

function world() {
  const keys = new Map();
  const hooks = new Map();
  const deliveries = [];
  const audit = [];
  const keyRepo = {
    create: async (k) => (keys.set(k.id, k), ok(undefined)), listByTenant: async () => ok([...keys.values()]),
    findByTokenHash: async (h) => ok([...keys.values()].find((k) => k.tokenHash === h) ?? null),
    revoke: async (id, t, at) => { const k = keys.get(id); if (!k || k.revokedAt) return ok(false); k.revokedAt = at; return ok(true); },
    touch: async (id, at) => { keys.get(id).lastUsedAt = at; },
  };
  const hookRepo = {
    createEndpoint: async (e) => (hooks.set(e.id, e), ok(undefined)), listEndpoints: async () => ok([...hooks.values()]), findEndpoint: async (id) => ok(hooks.get(id) ?? null),
    updateEndpoint: async (e) => (hooks.set(e.id, e), ok(undefined)), deleteEndpoint: async (id) => ok(hooks.delete(id)),
    subscribersOf: async (t, ev) => ok([...hooks.values()].filter((e) => e.enabled && e.events.includes(ev))),
    enqueue: async (rows) => (deliveries.push(...rows), ok(undefined)), recentDeliveries: async (t, id) => ok(deliveries.filter((d) => d.endpointId === id)),
  };
  const log = { record: async (e) => void audit.push(e) };
  return { keys, hooks, deliveries, audit, keyRepo, hookRepo, log };
}

test("only administrators manage keys; the token is returned once and only its hash is kept; scopes are required", async () => {
  const w = world();
  const create = new CreateApiKeyHandler(ids, w.keyRepo, w.log, clock, rnd);
  assert.equal((await create.handle(PM, { name: "BI", scopes: ["projects:read"] })).error.code, "FORBIDDEN");
  assert.match((await create.handle(ADMIN, { name: " ", scopes: ["projects:read"] })).error.message, /Name the key/);
  assert.match((await create.handle(ADMIN, { name: "BI", scopes: [] })).error.message, /at least one/);
  assert.match((await create.handle(ADMIN, { name: "BI", scopes: ["projects:write"] })).error.message, /at least one/);
  const made = await create.handle(ADMIN, { name: "Power BI", scopes: ["projects:read", "indicators:read"], expiresInDays: 30 });
  assert.ok(made.value.token.startsWith("dd_live_"));
  const stored = [...w.keys.values()][0];
  assert.equal(stored.tokenHash, hashApiToken(made.value.token));
  assert.ok(!JSON.stringify(made.value.key).includes(made.value.token));
  assert.equal(made.value.key.status, "ACTIVE");
  assert.equal(w.audit.at(-1).eventType, "api_key.created");
  assert.ok(!JSON.stringify(w.audit).includes(made.value.token));
  const listed = await new ListApiKeysHandler(w.keyRepo, clock).handle(ADMIN);
  assert.equal(listed.value[0].prefix, made.value.token.slice(0, 14));
  assert.equal((await new ListApiKeysHandler(w.keyRepo, clock).handle(PM)).error.code, "FORBIDDEN");
});

test("authenticating: unknown/missing 401, revoked/expired 401, wrong scope or project 403, good key touches lastUsed", async () => {
  const w = world();
  const made = await new CreateApiKeyHandler(ids, w.keyRepo, w.log, clock, rnd).handle(ADMIN, { name: "BI", scopes: ["projects:read"], projectIds: ["p1"], expiresInDays: 1 });
  const auth = new ApiKeyAuthenticator(w.keyRepo, clock);
  const bearer = (t) => `Bearer ${t}`;
  assert.deepEqual([(await auth.authenticate(undefined, { scope: "projects:read" })).status, (await auth.authenticate(bearer("dd_live_" + "x".repeat(50)), { scope: "projects:read" })).status], [401, 401]);
  const good = await auth.authenticate(bearer(made.value.token), { scope: "projects:read", projectId: "p1" });
  assert.ok(good.ok);
  assert.equal(good.principal.projectIds[0], "p1");
  assert.ok([...w.keys.values()][0].lastUsedAt);
  assert.equal((await auth.authenticate(bearer(made.value.token), { scope: "indicators:read" })).status, 403);
  assert.equal((await auth.authenticate(bearer(made.value.token), { scope: "projects:read", projectId: "p2" })).status, 403);
  now = new Date("2026-10-30T10:00:00Z");
  assert.equal((await auth.authenticate(bearer(made.value.token), { scope: "projects:read", projectId: "p1" })).reason, "EXPIRED");
  now = new Date("2026-10-28T10:00:00Z");
  assert.ok((await new RevokeApiKeyHandler(w.keyRepo, w.log, clock).handle(ADMIN, [...w.keys.keys()][0])).ok);
  assert.equal((await auth.authenticate(bearer(made.value.token), { scope: "projects:read", projectId: "p1" })).reason, "REVOKED");
  assert.equal((await new RevokeApiKeyHandler(w.keyRepo, w.log, clock).handle(ADMIN, "missing")).error.code, "NOT_FOUND");
});

test("webhooks: public https only, events required, secret shown once, switch back on clears failures", async () => {
  const w = world();
  const create = new CreateWebhookEndpointHandler(ids, w.hookRepo, w.log, clock, rnd);
  assert.match((await create.handle(ADMIN, { url: "http://x.example.org", events: ["report.approved"] })).error.message, /https/);
  assert.match((await create.handle(ADMIN, { url: "https://10.0.0.1/x", events: ["report.approved"] })).error.message, /private network/);
  assert.match((await create.handle(ADMIN, { url: "https://hooks.example.org/in", events: [] })).error.message, /Choose what/);
  assert.equal((await create.handle(PM, { url: "https://hooks.example.org/in", events: ["report.approved"] })).error.code, "FORBIDDEN");
  const made = await create.handle(ADMIN, { url: "https://hooks.example.org/in", events: ["report.approved"] });
  assert.ok(made.value.secret.startsWith("whsec_"));
  const listed = (await new ListWebhookEndpointsHandler(w.hookRepo).handle(ADMIN)).value;
  assert.ok(!JSON.stringify(listed).includes(made.value.secret));
  const id = made.value.endpoint.id;
  const stored = w.hooks.get(id);
  stored.consecutiveFailures = 9; stored.enabled = false; stored.disabledReason = "x";
  const upd = new UpdateWebhookEndpointHandler(w.hookRepo, w.log);
  assert.ok((await upd.handle(ADMIN, id, { enabled: true })).ok);
  assert.equal(w.hooks.get(id).consecutiveFailures, 0);
  assert.equal(w.hooks.get(id).disabledReason, undefined);
  assert.ok((await upd.handle(ADMIN, id, { events: ["report.approved", "period.locked"] })).ok);
  assert.match((await upd.handle(ADMIN, id, { events: ["nope"] })).error.message, /Choose what/);
  assert.equal((await upd.handle(ADMIN, "zz", { enabled: false })).error.code, "NOT_FOUND");
  assert.deepEqual((await new ListWebhookDeliveriesHandler(w.hookRepo).handle(ADMIN, id)).value, []);
  assert.ok((await new DeleteWebhookEndpointHandler(w.hookRepo, w.log).handle(ADMIN, id)).ok);
  assert.equal((await new DeleteWebhookEndpointHandler(w.hookRepo, w.log).handle(ADMIN, id)).error.code, "NOT_FOUND");
});

test("the dispatcher queues one signed-later delivery per subscriber, never throws, and refuses text in a payload", async () => {
  const w = world();
  const create = new CreateWebhookEndpointHandler(ids, w.hookRepo, w.log, clock, rnd);
  await create.handle(ADMIN, { url: "https://a.example.org/in", events: ["report.approved"] });
  await create.handle(ADMIN, { url: "https://b.example.org/in", events: ["report.approved", "period.locked"] });
  await create.handle(ADMIN, { url: "https://c.example.org/in", events: ["period.locked"] });
  const errors = [];
  const d = new WebhookDispatcher(w.hookRepo, ids, clock, (e) => errors.push(e));
  await d.emit(tenantId, "report.approved", { reportId: "r1", status: "APPROVED" });
  assert.equal(w.deliveries.length, 2);
  const payload = JSON.parse(w.deliveries[0].payloadJson);
  assert.equal(payload.event, "report.approved");
  assert.equal(payload.tenant, "tenant-a");
  assert.deepEqual(payload.data, { reportId: "r1", status: "APPROVED" });
  assert.equal(w.deliveries[0].eventId, w.deliveries[1].eventId);
  await d.emit(tenantId, "report.approved", { sectionText: "secret narrative" });
  assert.equal(w.deliveries.length, 2);
  assert.equal(errors.length, 1);
  const broken = new WebhookDispatcher({ subscribersOf: async () => { throw new Error("db down"); } }, ids, clock, (e) => errors.push(e));
  await broken.emit(tenantId, "report.approved", { reportId: "r1" });
  assert.equal(errors.length, 2);
});

test("the API project list shows only the key's projects, never archived ones", async () => {
  const p = (id, archivedAt) => ({ id, projectCode: id, title: id, donorName: "D", country: "C", sector: "S", status: "ACTIVE", duration: { start: new Date("2026-01-01"), end: new Date("2026-12-31") }, archivedAt });
  const h = new ListApiProjectsHandler({ listByTenant: async () => ok([p("a"), p("b"), p("c", new Date())]) });
  assert.deepEqual((await h.handle(tenantId, [])).value.map((x) => x.id), ["a", "b"]);
  assert.deepEqual((await h.handle(tenantId, ["b", "c"])).value.map((x) => x.id), ["b"]);
});

test("approving a report announces it to webhooks even when the author approved it; the person is not told about their own action", async () => {
  const { ReportNotifier } = await import("../dist/index.js");
  const emitted = [];
  const sent = [];
  const notifier = new ReportNotifier({ send: async (x) => void sent.push(x) }, {}, {}, { emit: async (t, e, d) => void emitted.push([e, d]) });
  await notifier.approved(tenantId, "author", { id: "r1", projectId: "p1", createdById: "author" });
  assert.deepEqual(emitted, [["report.approved", { reportId: "r1", projectId: "p1", status: "APPROVED" }]]);
  assert.equal(sent.length, 0);
  await notifier.approved(tenantId, "boss", { id: "r2", projectId: "p1", createdById: "author" });
  assert.equal(emitted.length, 2);
  assert.equal(sent.length, 1);
});
