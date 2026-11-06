import assert from "node:assert/strict";
import test from "node:test";
import { InviteUserHandler } from "../dist/index.js";
import { TenantId } from "@donordesk/domain";

const tenantId = TenantId.create("tenant-a");
const ctx = { tenant: { tenantId, userId: "admin", role: "ADMIN" }, requestId: "r" };
const ok = (value) => ({ ok: true, value });

function build() {
  const created = [];
  const entitlements = { resolve: async () => ok({ limits: { maxSeats: null, viewerSeats: null } }), usageSnapshot: async () => ok({ seats: 0, viewerSeats: 0 }) };
  const h = new InviteUserHandler(
    { generate: () => "id" },
    { findByEmail: async () => ok(null) },
    { create: async (i) => { created.push(i); return ok(i); } },
    { record: async () => {} },
    { notify: async () => {} },
    entitlements,
    { findById: async (id) => ok(id === "p1" || id === "p2" ? { id } : null) },
  );
  return { h, created };
}

test("H-15: an outside partner is a field officer or viewer on named projects, nothing else", async () => {
  const { h, created } = build();
  assert.equal((await h.handle(ctx, { email: "a@partner.org", role: "PROJECT_MANAGER", projectIds: ["p1"], external: true })).ok, false);
  assert.equal((await h.handle(ctx, { email: "a@partner.org", role: "ADMIN", projectIds: ["p1"], external: true })).ok, false);
  const none = await h.handle(ctx, { email: "a@partner.org", role: "FIELD_OFFICER", projectIds: [], external: true });
  assert.equal(none.ok, false);
  assert.match(none.error.message, /Choose the project/);
  assert.equal(created.length, 0);
  const good = await h.handle(ctx, { email: "a@partner.org", role: "FIELD_OFFICER", projectIds: ["p1", "p2"], external: true });
  assert.equal(good.ok, true);
  assert.equal(created[0].external, true);
  assert.deepEqual(created[0].projectIds, ["p1", "p2"]);
});

test("H-15: every project an invitation names must exist in the organisation, for any role", async () => {
  const { h, created } = build();
  const r = await h.handle(ctx, { email: "b@org.org", role: "ME_OFFICER", projectIds: ["p1", "ghost"] });
  assert.equal(r.ok, false);
  assert.equal(r.error.code, "NOT_FOUND");
  assert.equal(created.length, 0);
  assert.equal((await h.handle(ctx, { email: "b@org.org", role: "ME_OFFICER", projectIds: [] })).ok, true);
  assert.equal(created.at(-1).external, false);
});
