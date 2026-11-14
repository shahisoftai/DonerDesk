import assert from "node:assert/strict";
import test from "node:test";
import { SetUserStatusHandler } from "../dist/index.js";
import { Email, TenantId, User, UserId } from "@donordesk/domain";

const tenantId = TenantId.create("tenant-a");
const person = (id, role, status = "ACTIVE") => {
  const u = User.create({ id: UserId.create(id), tenantId, email: Email.create(`${id}@example.org`), name: `Person ${id}`, passwordHash: "x", role });
  if (status === "ACTIVE") u.activate();
  if (status === "SUSPENDED") { u.activate(); u.suspend(); }
  return u;
};

function setup(people) {
  const byId = new Map(people.map((u) => [u.id.toString(), u]));
  const events = [];
  const memberships = [{ projectId: "p1", userId: "field", status: "ACTIVE", remove() { this.status = "REMOVED"; } }];
  const users = {
    findById: async (id) => ({ ok: true, value: byId.get(id) ?? null }),
    listByTenant: async () => ({ ok: true, value: [...byId.values()] }),
    update: async (u) => ({ ok: true, value: u }),
  };
  const members = {
    listActiveProjectIdsForUser: async (userId) => ({ ok: true, value: memberships.filter((m) => m.userId === userId && m.status === "ACTIVE").map((m) => m.projectId) }),
    findByUserAndProject: async (projectId, userId) => ({ ok: true, value: memberships.find((m) => m.projectId === projectId && m.userId === userId) ?? null }),
    update: async (m) => ({ ok: true, value: m }),
  };
  const audit = { record: async (e) => { events.push(e); return { ok: true, value: undefined }; } };
  return { handler: new SetUserStatusHandler(users, members, audit), byId, events, memberships };
}
const ctx = (userId = "admin", role = "ADMIN") => ({ tenant: { tenantId, userId, role }, requestId: "r" });

test("deactivate is reversible and audited; reactivate restores the person", async () => {
  const { handler, byId, events } = setup([person("admin", "ADMIN"), person("field", "FIELD_OFFICER")]);
  const off = await handler.handle(ctx(), { userId: "field", action: "DEACTIVATE" });
  assert.equal(off.ok && off.value.status, "SUSPENDED");
  const on = await handler.handle(ctx(), { userId: "field", action: "REACTIVATE" });
  assert.equal(on.ok && on.value.status, "ACTIVE");
  assert.deepEqual(events.map((e) => e.eventType), ["identity.user.deactivated", "identity.user.reactivated"]);
  assert.equal(byId.get("field").name, "Person field");
});

test("delete removes the account, ends memberships and erases name and email, without recording them again", async () => {
  const { handler, byId, events, memberships } = setup([person("admin", "ADMIN"), person("field", "FIELD_OFFICER")]);
  const r = await handler.handle(ctx(), { userId: "field", action: "DELETE" });
  assert.equal(r.ok && r.value.status, "REMOVED");
  const u = byId.get("field");
  assert.equal(u.name, "Removed user");
  assert.match(u.email.toString(), /^removed\+field@deleted\.invalid$/);
  assert.equal(memberships[0].status, "REMOVED");
  assert.doesNotMatch(events[0].newValue, /field@example/);
  const again = await handler.handle(ctx(), { userId: "field", action: "REACTIVATE" });
  assert.equal(again.ok, false, "a deleted person cannot be brought back");
});

test("nobody acts on themselves, and the last active administrator stays", async () => {
  const { handler } = setup([person("admin", "ADMIN"), person("other", "ADMIN", "SUSPENDED")]);
  const self = await handler.handle(ctx(), { userId: "admin", action: "DEACTIVATE" });
  assert.equal(self.ok, false);
  const { handler: h2 } = setup([person("admin", "PROJECT_MANAGER"), person("boss", "ADMIN")]);
  await assert.rejects(() => h2.handle(ctx("admin", "PROJECT_MANAGER"), { userId: "boss", action: "DELETE" }), (e) => e?.code === "FORBIDDEN");
  const { handler: h3 } = setup([person("admin", "ADMIN"), person("boss", "ADMIN")]);
  const lastAdmin = await h3.handle(ctx(), { userId: "boss", action: "DELETE" });
  assert.equal(lastAdmin.ok, true, "another active administrator remains (the caller)");
});
