import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, createHmac } from "node:crypto";
import {
  API_KEY_PREFIX, newApiToken, hashApiToken, bearerApiToken, sameHash, checkApiKey,
  signWebhook, verifyWebhookSignature, webhookRetryDelaySeconds, checkWebhookUrl, isPrivateAddress, checkWebhookData, isWebhookEvent,
} from "../dist/index.js";

test("a token is long, prefixed, and only its hash is derivable; a header is read strictly", () => {
  const t = newApiToken((n) => Buffer.alloc(n, 7));
  assert.ok(t.token.startsWith(API_KEY_PREFIX));
  assert.equal(t.tokenHash, hashApiToken(t.token));
  assert.equal(t.prefix, t.token.slice(0, 14));
  assert.notEqual(newApiToken(randomBytes).token, newApiToken(randomBytes).token);
  assert.equal(bearerApiToken(`Bearer ${t.token}`), t.token);
  assert.equal(bearerApiToken(`bearer ${t.token}`), t.token);
  assert.equal(bearerApiToken("Bearer short"), undefined);
  assert.equal(bearerApiToken(`Basic ${t.token}`), undefined);
  assert.equal(bearerApiToken(`Bearer ${t.token} extra`), undefined);
  assert.equal(bearerApiToken(undefined), undefined);
  assert.ok(sameHash(t.tokenHash, hashApiToken(t.token)));
  assert.ok(!sameHash(t.tokenHash, hashApiToken("other")));
  assert.ok(!sameHash("", ""));
});

test("a key is refused when revoked, expired, out of scope or for another project", () => {
  const now = new Date("2026-10-28T00:00:00Z");
  const key = { scopes: ["projects:read"], projectIds: ["p1"] };
  assert.equal(checkApiKey(key, { scope: "projects:read", projectId: "p1" }, now), null);
  assert.equal(checkApiKey(key, { scope: "indicators:read" }, now), "SCOPE");
  assert.equal(checkApiKey(key, { scope: "projects:read", projectId: "p2" }, now), "PROJECT");
  assert.equal(checkApiKey({ ...key, projectIds: [] }, { scope: "projects:read", projectId: "p2" }, now), null);
  assert.equal(checkApiKey({ ...key, revokedAt: now }, { scope: "projects:read" }, now), "REVOKED");
  assert.equal(checkApiKey({ ...key, expiresAt: now }, { scope: "projects:read" }, now), "EXPIRED");
  assert.equal(checkApiKey({ ...key, expiresAt: new Date("2026-11-01") }, { scope: "projects:read" }, now), null);
});

test("webhook signature: a known vector, tamper, stale and wrong secret all fail", () => {
  const body = '{"id":"e1","event":"report.approved"}';
  const header = signWebhook("s3cret", 1_800_000_000, body);
  assert.match(header, /^t=1800000000,v1=[0-9a-f]{64}$/);
  const expected = createHmac("sha256", "s3cret").update(`1800000000.${body}`).digest("hex");
  assert.equal(header, `t=1800000000,v1=${expected}`);
  assert.ok(verifyWebhookSignature("s3cret", header, body, 1_800_000_100));
  assert.ok(!verifyWebhookSignature("s3cret", header, body + " ", 1_800_000_100));
  assert.ok(!verifyWebhookSignature("other", header, body, 1_800_000_100));
  assert.ok(!verifyWebhookSignature("s3cret", header, body, 1_800_001_000));
  assert.ok(!verifyWebhookSignature("s3cret", "garbage", body, 1_800_000_100));
});

test("retry delays grow by four and stop growing at six hours", () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8].map(webhookRetryDelaySeconds), [30, 120, 480, 1920, 7680, 21600, 21600, 21600]);
});

test("a webhook address must be public https; private, internal and credentialed addresses are refused", () => {
  assert.ok(checkWebhookUrl("https://hooks.example.org/in").ok);
  for (const bad of [
    "http://hooks.example.org", "https://localhost/x", "https://127.0.0.1/x", "https://10.1.2.3/x", "https://192.168.0.5/x", "https://172.16.0.1/x",
    "https://169.254.169.254/latest/meta-data", "https://[::1]/x", "https://[fd00::1]/x", "https://intranet/x", "https://svc.internal/x", "https://user:pw@hooks.example.org/x",
    "https://100.64.0.1/x", "https://[::ffff:10.0.0.1]/x", "not a url",
  ]) assert.ok(!checkWebhookUrl(bad).ok, bad);
  assert.ok(isPrivateAddress("172.31.255.255"));
  assert.ok(!isPrivateAddress("172.32.0.1"));
  assert.ok(!isPrivateAddress("93.184.216.34"));
});

test("a payload carries ids and simple values only; anything text-shaped is refused", () => {
  assert.ok(checkWebhookData({ reportId: "r1", periodId: "p1", status: "APPROVED", count: 3, ok: true }).ok);
  assert.ok(!checkWebhookData({ sectionText: "hello" }).ok);
  assert.ok(!checkWebhookData({ projectName: "x" }).ok);
  assert.ok(!checkWebhookData({ nested: { a: 1 } }).ok);
  assert.ok(!checkWebhookData({ id: "x".repeat(200) }).ok);
  assert.ok(isWebhookEvent("report.approved"));
  assert.ok(!isWebhookEvent("report.deleted"));
});
