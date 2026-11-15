import assert from "node:assert/strict";
import test from "node:test";
import { CancelInvitationHandler } from "../dist/index.js";
import { Email, TenantId } from "@donordesk/domain";

const tenantId = TenantId.create("tenant-a");
const ctx = (role = "ADMIN") => ({ tenant: { tenantId, userId: "admin", role }, requestId: "r" });
const open = [{ id: "inv-1", email: Email.create("someone@example.org"), role: "VIEWER" }];

function setup(list = open) {
  const events = [];
  const cancelled = [];
  const invitations = {
    listOpenByTenant: async () => ({ ok: true, value: list }),
    cancelOpen: async (id) => { cancelled.push(id); return { ok: true, value: true }; },
  };
  const audit = { record: async (e) => { events.push(e); return { ok: true, value: undefined }; } };
  return { handler: new CancelInvitationHandler(invitations, audit), events, cancelled };
}

test("an open invitation is withdrawn and audited without the address", async () => {
  const { handler, events, cancelled } = setup();
  const r = await handler.handle(ctx(), "inv-1");
  assert.equal(r.ok, true);
  assert.deepEqual(cancelled, ["inv-1"]);
  assert.equal(events[0].eventType, "identity.invitation.cancelled");
  assert.doesNotMatch(JSON.stringify(events[0]), /someone@example/);
  assert.match(events[0].oldValue, /example\.org/);
});

test("an unknown or already accepted invitation is not found; only managers may cancel", async () => {
  const { handler } = setup([]);
  const r = await handler.handle(ctx(), "inv-9");
  assert.equal(r.ok, false);
  await assert.rejects(() => setup().handler.handle(ctx("VIEWER"), "inv-1"), (e) => e?.code === "FORBIDDEN");
});
