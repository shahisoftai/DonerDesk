import assert from "node:assert/strict";
import test from "node:test";
import { RequestIdempotencyService } from "../dist/index.js";

const ok = (value) => ({ ok: true, value });
const id = (s) => `${s.tenantId}|${s.userId}|${s.route}|${s.key}`;

function memoryStore() {
  const rows = new Map();
  return {
    rows,
    async insertPending(scope, now) { if (rows.has(id(scope))) return ok("EXISTS"); rows.set(id(scope), { state: "PENDING", createdAt: now }); return ok("CREATED"); },
    async find(scope) { return ok(rows.get(id(scope)) ?? null); },
    async complete(scope, response) { Object.assign(rows.get(id(scope)), { state: "DONE", ...response }); return ok(undefined); },
    async release(scope) { rows.delete(id(scope)); return ok(undefined); },
  };
}
const scope = { tenantId: "t1", userId: "u1", route: "/v1/projects", key: "form-key-0001" };
const response = { statusCode: 201, body: '{"id":"p1"}', contentType: "application/json" };

test("the first request runs; a repeat after it finished gets the first response back", async () => {
  const svc = new RequestIdempotencyService(memoryStore());
  assert.deepEqual((await svc.begin(scope)).value, { kind: "NEW" });
  await svc.finish(scope, response);
  assert.deepEqual((await svc.begin(scope)).value, { kind: "REPLAY", ...response });
  assert.deepEqual((await svc.begin(scope)).value.body, '{"id":"p1"}', "and again");
});

test("a repeat while the first is still running is told to wait, so a double click creates one record", async () => {
  const svc = new RequestIdempotencyService(memoryStore());
  assert.equal((await svc.begin(scope)).value.kind, "NEW");
  assert.equal((await svc.begin(scope)).value.kind, "IN_PROGRESS");
});

test("a failed first request frees the key; so does an abandoned one", async () => {
  const svc = new RequestIdempotencyService(memoryStore());
  await svc.begin(scope);
  await svc.finish(scope, { statusCode: 409, body: "{}" });
  assert.equal((await svc.begin(scope)).value.kind, "NEW", "a refused create can be retried with the same key");
  await svc.abandon(scope);
  assert.equal((await svc.begin(scope)).value.kind, "NEW");
});

test("keys are scoped by tenant, user and route", async () => {
  const svc = new RequestIdempotencyService(memoryStore());
  await svc.begin(scope);
  await svc.finish(scope, response);
  for (const other of [{ ...scope, tenantId: "t2" }, { ...scope, userId: "u2" }, { ...scope, route: "/v1/indicators" }]) {
    assert.equal((await svc.begin(other)).value.kind, "NEW", JSON.stringify(other));
  }
});

test("a record that died mid-request, or outlived its day, frees the key", async () => {
  let clock = new Date("2026-10-06T12:00:00Z");
  const store = memoryStore();
  const svc = new RequestIdempotencyService(store, () => clock);
  await svc.begin(scope);
  clock = new Date(clock.getTime() + 3 * 60 * 1000);
  assert.equal((await svc.begin(scope)).value.kind, "NEW", "a pending record older than two minutes is dead");
  await svc.finish(scope, response);
  clock = new Date(clock.getTime() + 25 * 60 * 60 * 1000);
  assert.equal((await svc.begin(scope)).value.kind, "NEW", "a stored response expires after 24 hours");
});

test("an invalid key is refused and a down store surfaces", async () => {
  const svc = new RequestIdempotencyService(memoryStore());
  assert.equal((await svc.begin({ ...scope, key: "no" })).value.kind, "INVALID_KEY");
  const broken = new RequestIdempotencyService({ ...memoryStore(), insertPending: async () => ({ ok: false, error: new Error("down") }) });
  assert.equal((await broken.begin(scope)).ok, false);
});
