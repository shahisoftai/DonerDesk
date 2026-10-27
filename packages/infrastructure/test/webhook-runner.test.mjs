import test from "node:test";
import assert from "node:assert/strict";
import { TenantId, verifyWebhookSignature } from "@donordesk/domain";
import { WebhookDeliveryRunner } from "../dist/integrations/webhook-runner.js";

const tenantId = TenantId.create("tenant-a");
const now = new Date("2026-10-28T10:00:00Z");
const endpoint = (over = {}) => ({ id: "e1", tenantId, url: "https://hooks.example.org/in", secret: "whsec_x", events: ["report.approved"], enabled: true, consecutiveFailures: 0, createdById: "u", createdAt: now, ...over });
const delivery = (over = {}) => ({ id: "d1", tenantId, endpointId: "e1", eventId: "ev1", event: "report.approved", payloadJson: '{"id":"ev1"}', status: "PENDING", attempts: 0, nextAttemptAt: now, createdAt: now, ...over });

function run({ due, resolve = async () => ["93.184.216.34"], post = async () => ({ status: 200 }) }) {
  const attempts = [];
  const hooks = { claimDue: async () => due, recordAttempt: async (a) => void attempts.push(a) };
  const logs = [];
  const runner = new WebhookDeliveryRunner(hooks, { info() {}, debug() {}, error() {}, warn: (m, x) => logs.push([m, x]) }, resolve, post);
  return { runner, attempts, logs };
}

test("a 2xx delivers, with a verifiable signature and the event headers", async () => {
  let seen;
  const r = run({ due: [{ delivery: delivery(), endpoint: endpoint() }], post: async (url, init) => { seen = { url, ...init }; return { status: 204 }; } });
  const out = await r.runner.runOnce(now);
  assert.deepEqual(out, { sent: 1, delivered: 1, retried: 0, gaveUp: 0 });
  assert.equal(r.attempts[0].status, "DELIVERED");
  assert.equal(seen.headers["x-donordesk-event"], "report.approved");
  assert.ok(verifyWebhookSignature("whsec_x", seen.headers["x-donordesk-signature"], seen.body, Math.floor(now.getTime() / 1000)));
});

test("a failing receiver is retried later; the eighth failure gives up and counts against the endpoint", async () => {
  const bad = async () => ({ status: 500 });
  const first = run({ due: [{ delivery: delivery(), endpoint: endpoint() }], post: bad });
  assert.equal((await first.runner.runOnce(now)).retried, 1);
  assert.equal(first.attempts[0].status, "PENDING");
  assert.equal(first.attempts[0].nextAttemptAt.getTime() - now.getTime(), 30_000);
  const last = run({ due: [{ delivery: delivery({ attempts: 7 }), endpoint: endpoint({ consecutiveFailures: 9 }) }], post: bad });
  assert.equal((await last.runner.runOnce(now)).gaveUp, 1);
  assert.equal(last.attempts[0].status, "FAILED");
  assert.equal(last.attempts[0].endpointFailed, true);
  assert.match(last.attempts[0].disable, /Switched off after 10 failed deliveries/);
});

test("a name that resolves to a private address is never called; a timeout or network error is a retry", async () => {
  let called = false;
  const inward = run({ due: [{ delivery: delivery(), endpoint: endpoint() }], resolve: async () => ["93.184.216.34", "169.254.169.254"], post: async () => { called = true; return { status: 200 }; } });
  await inward.runner.runOnce(now);
  assert.equal(called, false);
  assert.match(inward.attempts[0].error, /private network/);
  const down = run({ due: [{ delivery: delivery(), endpoint: endpoint() }], post: async () => { throw new Error("ECONNREFUSED"); } });
  await down.runner.runOnce(now);
  assert.match(down.attempts[0].error, /could not be reached/);
  const slow = run({ due: [{ delivery: delivery(), endpoint: endpoint() }], post: async () => { const e = new Error("t"); e.name = "AbortError"; throw e; } });
  await slow.runner.runOnce(now);
  assert.match(slow.attempts[0].error, /did not answer in time/);
});

test("a removed or switched-off endpoint ends the delivery without calling anything", async () => {
  let called = false;
  const r = run({ due: [{ delivery: delivery(), endpoint: null }, { delivery: delivery({ id: "d2" }), endpoint: endpoint({ enabled: false }) }], post: async () => { called = true; return { status: 200 }; } });
  const out = await r.runner.runOnce(now);
  assert.equal(called, false);
  assert.equal(out.gaveUp, 2);
});
