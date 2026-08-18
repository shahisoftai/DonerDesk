import assert from "node:assert/strict";
import test from "node:test";
import {
  computeWebhookSignature,
  verifyWebhookSignature,
  assertSafeWebhookUrl,
} from "../dist/webhooks/index.js";
import { DonorPortalService } from "../dist/integrations/donor-portal.js";

test("webhook verification rejects malformed and stale timestamps", () => {
  const secret = "a".repeat(32);
  const payload = JSON.stringify({ id: "evt-1" });
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = computeWebhookSignature(payload, secret, timestamp);
  assert.equal(verifyWebhookSignature(payload, secret, timestamp, signature), true);
  assert.equal(verifyWebhookSignature(payload, secret, "not-a-time", signature), false);
  assert.equal(verifyWebhookSignature(payload, secret, "1", signature), false);
  assert.equal(verifyWebhookSignature(payload, secret, timestamp, "bad"), false);
});

test("webhook URLs reject clear SSRF targets", () => {
  assert.doesNotThrow(() => assertSafeWebhookUrl("https://hooks.example.org/events"));
  assert.throws(() => assertSafeWebhookUrl("http://hooks.example.org/events"));
  assert.throws(() => assertSafeWebhookUrl("https://127.0.0.1/events"));
  assert.throws(() => assertSafeWebhookUrl("https://169.254.169.254/latest/meta-data"));
});

test("donor portal tokens are tenant-bound and tamper evident", () => {
  const service = new DonorPortalService({
    baseUrl: "https://portal.example.org",
    signingSecret: "ab".repeat(32),
  });
  const signed = service.generateSignedUrl({
    tenantId: "tenant-a",
    resourceType: "report",
    resourceId: "report-1",
    permissions: ["view"],
  });
  assert.equal(service.verifySignedUrl(signed.token, "tenant-a").valid, true);
  assert.equal(service.verifySignedUrl(signed.token, "tenant-b").valid, false);
  const sig = signed.token.slice(-64);
  const flippedSig = (sig[0] === "0" ? "1" : "0") + sig.slice(1);
  const tampered = `${signed.token.slice(0, -64)}${flippedSig}`;
  assert.equal(service.verifySignedUrl(tampered, "tenant-a").valid, false);
});
