import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { RequestIdempotencyService } from "@donordesk/application";
import { idempotencyBegin, idempotencyFinish } from "../dist/middleware/idempotency.js";

const ok = (value) => ({ ok: true, value });

/** A Fastify instance with only the two hooks, an in-memory store and a counting create route: no database. */
async function app({ userId = "u1", failing = false } = {}) {
  const rows = new Map();
  const key = (s) => `${s.tenantId}|${s.userId}|${s.route}|${s.key}`;
  const store = {
    async insertPending(s, now) { if (rows.has(key(s))) return ok("EXISTS"); rows.set(key(s), { state: "PENDING", createdAt: now }); return ok("CREATED"); },
    async find(s) { return ok(rows.get(key(s)) ?? null); },
    async complete(s, r) { Object.assign(rows.get(key(s)), { state: "DONE", ...r }); return ok(undefined); },
    async release(s) { rows.delete(key(s)); return ok(undefined); },
  };
  const container = { requestIdempotency: new RequestIdempotencyService(store) };
  const f = Fastify();
  f.addHook("preHandler", async (req) => { req.tenant = { tenantId: { toString: () => "t1" }, userId }; req.container = container; });
  f.addHook("preHandler", idempotencyBegin);
  f.addHook("onSend", idempotencyFinish);
  let created = 0;
  f.post("/v1/things", async (_req, reply) => { created += 1; if (failing) return reply.status(409).send({ title: "no" }); return reply.status(201).send({ id: `thing-${created}` }); });
  f.get("/v1/things", async () => ({ ok: true }));
  return { f, count: () => created, rows };
}
const post = (f, headers = {}) => f.inject({ method: "POST", url: "/v1/things", payload: {}, headers });

test("without a key every create runs, as before", async () => {
  const { f, count } = await app();
  await post(f); await post(f);
  assert.equal(count(), 2);
});

test("a repeated key creates once and replays the first response", async () => {
  const { f, count } = await app();
  const headers = { "idempotency-key": "form-key-0001" };
  const first = await post(f, headers);
  const second = await post(f, headers);
  assert.equal(count(), 1);
  assert.equal(first.statusCode, 201);
  assert.equal(second.statusCode, 201);
  assert.equal(second.json().id, "thing-1");
  assert.equal(second.headers["idempotent-replayed"], "true");
  assert.equal(first.headers["idempotent-replayed"], undefined);
});

test("a different key is a different creation", async () => {
  const { f, count } = await app();
  await post(f, { "idempotency-key": "form-key-0001" });
  await post(f, { "idempotency-key": "form-key-0002" });
  assert.equal(count(), 2);
});

test("a failed create is not stored: the same key can be retried", async () => {
  const { f, count, rows } = await app({ failing: true });
  const headers = { "idempotency-key": "form-key-0003" };
  assert.equal((await post(f, headers)).statusCode, 409);
  assert.equal(rows.size, 0, "the key is free again");
  await post(f, headers);
  assert.equal(count(), 2);
});

test("an invalid key is a 400 and creates nothing; a GET ignores the header", async () => {
  const { f, count } = await app();
  const bad = await post(f, { "idempotency-key": "x" });
  assert.equal(bad.statusCode, 400);
  assert.equal(count(), 0);
  assert.equal((await f.inject({ method: "GET", url: "/v1/things", headers: { "idempotency-key": "x" } })).statusCode, 200);
});

test("a repeat while the first is still running is a retryable 503 with Retry-After", async () => {
  const { f, rows } = await app();
  rows.set("t1|u1|/v1/things|form-key-0004", { state: "PENDING", createdAt: new Date() });
  const res = await post(f, { "idempotency-key": "form-key-0004" });
  assert.equal(res.statusCode, 503);
  assert.equal(res.headers["retry-after"], "2");
  assert.equal(res.json().code, "IDEMPOTENCY_IN_PROGRESS");
});
