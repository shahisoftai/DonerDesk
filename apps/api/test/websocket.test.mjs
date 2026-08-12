import assert from "node:assert/strict";
import test from "node:test";
import { TenantId } from "@donordesk/domain";
import { CollaborationGateway } from "../dist/websocket/gateway.js";

class FakeSocket {
  sent = [];
  send(data) { this.sent.push(JSON.parse(data)); }
  close() {}
  on() {}
}

const users = {
  "token-a-1": { userId: "shared-id", tenantId: TenantId.create("tenant-a"), role: "ADMIN", email: "a1@example.org", name: "A1" },
  "token-a-2": { userId: "user-2", tenantId: TenantId.create("tenant-a"), role: "ADMIN", email: "a2@example.org", name: "A2" },
  "token-b-1": { userId: "shared-id", tenantId: TenantId.create("tenant-b"), role: "ADMIN", email: "b1@example.org", name: "B1" },
};

test("collaboration channels isolate tenants and require membership for edits", async () => {
  const gateway = new CollaborationGateway(async (token) => users[token] ?? null);
  const a1 = new FakeSocket();
  const a2 = new FakeSocket();
  const b1 = new FakeSocket();
  await gateway.handleConnection(a1, { token: "token-a-1" });
  await gateway.handleConnection(a2, { token: "token-a-2" });
  await gateway.handleConnection(b1, { token: "token-b-1" });

  await gateway.handleMessage(a1, JSON.stringify({ type: "join_channel", channel: "period:section" }));
  await gateway.handleMessage(b1, JSON.stringify({ type: "join_channel", channel: "period:section" }));
  assert.deepEqual(gateway.getChannelParticipants(TenantId.create("tenant-a"), "period:section"), ["shared-id"]);
  assert.deepEqual(gateway.getChannelParticipants(TenantId.create("tenant-b"), "period:section"), ["shared-id"]);

  const rejected = await gateway.handleMessage(a2, JSON.stringify({ type: "content_edit", channel: "period:section", payload: { text: "unauthorized" } }));
  assert.equal(rejected, null);
  assert.equal(a1.sent.some((message) => message.payload?.text === "unauthorized"), false);

  await gateway.handleMessage(a2, JSON.stringify({ type: "join_channel", channel: "period:section" }));
  await gateway.handleMessage(a2, JSON.stringify({ type: "content_edit", channel: "period:section", payload: { text: "authorized" } }));
  assert.equal(a1.sent.some((message) => message.payload?.text === "authorized"), true);
  assert.equal(b1.sent.some((message) => message.payload?.text === "authorized"), false);
});

test("collaboration gateway rejects invalid channels and oversized messages", async () => {
  const gateway = new CollaborationGateway(async (token) => users[token] ?? null);
  const socket = new FakeSocket();
  await gateway.handleConnection(socket, { token: "token-a-1" });
  assert.equal(await gateway.handleMessage(socket, JSON.stringify({ type: "join_channel", channel: "../tenant-b" })), null);
  assert.equal(await gateway.handleMessage(socket, JSON.stringify({ type: "join_channel", channel: "x", payload: { text: "a".repeat(70_000) } })), null);
});
