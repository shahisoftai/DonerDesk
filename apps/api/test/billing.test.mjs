import assert from "node:assert/strict";
import test from "node:test";
import { createHmac } from "node:crypto";

process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/donordesk";
process.env.DATABASE_ADMIN_URL ??= process.env.DATABASE_URL;
process.env.JWT_SECRET ??= "test-secret-that-is-at-least-32-characters";
process.env.BILLING_PROVIDER ??= "stub";

const { buildServer } = await import("../dist/server.js");
const { JwtAuthProvider } = await import("@donordesk/infrastructure");

const WEBHOOK_SECRET = "test-webhook-secret";

function signedWebhook(secret, bodyObj) {
  const raw = Buffer.from(JSON.stringify(bodyObj), "utf8");
  const signature = createHmac("sha256", secret).update(raw).digest("hex");
  return { raw, signature, body: raw.toString("utf8") };
}

/** True when the configured Postgres is reachable; DB tests are skipped otherwise. */
async function databaseAvailable() {
  const { createConnection } = await import("node:net");
  const { DATABASE_URL } = process.env;
  try {
    const url = new URL(DATABASE_URL);
    const host = url.hostname;
    const port = Number(url.port || 5432);
    const available = await new Promise((resolve) => {
      const socket = createConnection({ host, port, timeout: 1500 });
      socket.once("connect", () => { socket.destroy(); resolve(true); });
      socket.once("error", () => resolve(false));
      socket.once("timeout", () => { socket.destroy(); resolve(false); });
    });
    return available;
  } catch {
    return false;
  }
}

const HAS_DB = await databaseAvailable();
const maybe = HAS_DB ? test : test.skip;

test("creem webhook rejects invalid signatures", async (t) => {
  const app = await buildServer();
  t.after(() => app.close());
  const body = { id: "evt_bad", eventType: "subscription.paid", object: {} };
  const response = await app.inject({
    method: "POST",
    url: "/v1/webhooks/creem",
    headers: { "content-type": "application/json", "creem-signature": "not-a-valid-signature" },
    payload: JSON.stringify(body),
  });
  assert.equal(response.statusCode, 401);
});

maybe("creem webhook returns 200 for a valid event and is idempotent", async (t) => {
  const app = await buildServer();
  t.after(() => app.close());
  const payload = {
    id: "evt_ok_1",
    eventType: "subscription.paid",
    created_at: Date.now(),
    object: {
      id: "sub_ok_1",
      product: { id: "prod-team-monthly", price: 5900, currency: "USD", billing_period: "every-month" },
      customer: { id: "cust_ok_1", email: "org@example.com" },
      status: "active",
      current_period_start_date: "2026-01-01T00:00:00.000Z",
      current_period_end_date: "2026-02-01T00:00:00.000Z",
      updated_at: "2026-01-15T00:00:00.000Z",
    },
  };
  const { raw, signature } = signedWebhook(WEBHOOK_SECRET, payload);
  const headers = { "content-type": "application/json", "creem-signature": signature };

  const first = await app.inject({ method: "POST", url: "/v1/webhooks/creem", headers, payload: raw });
  assert.equal(first.statusCode, 200);

  const second = await app.inject({ method: "POST", url: "/v1/webhooks/creem", headers, payload: raw });
  assert.equal(second.statusCode, 200);
});

test("billing routes enforce billing.manage for mutations", async (t) => {
  const app = await buildServer();
  t.after(() => app.close());
  const viewer = await new JwtAuthProvider().sign({
    sub: "viewer-1", tid: "tenant-a", role: "VIEWER", name: "Viewer", email: "viewer@example.org",
  }, 60);
  const headers = { authorization: `Bearer ${viewer}` };

  const checkout = await app.inject({ method: "POST", url: "/v1/billing/checkout", headers, payload: { plan: "TEAM", interval: "MONTH" } });
  assert.equal(checkout.statusCode, 403);
  const portal = await app.inject({ method: "POST", url: "/v1/billing/portal", headers, payload: {} });
  assert.equal(portal.statusCode, 403);
});

maybe("billing summary is readable by any authenticated role", async (t) => {
  const app = await buildServer();
  t.after(() => app.close());
  const token = await new JwtAuthProvider().sign({
    sub: "admin-1", tid: "tenant-a", role: "ADMIN", name: "Admin", email: "admin@example.org",
  }, 60);
  const headers = { authorization: `Bearer ${token}` };
  const response = await app.inject({ method: "GET", url: "/v1/billing/summary", headers });
  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.plan, "STARTER");
  assert.ok(body.usage);
  assert.ok(body.usage.projects.limit === 1);
});
