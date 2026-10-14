import assert from "node:assert/strict";
import test from "node:test";
import { ListPendingInvitationsHandler } from "../dist/index.js";
import { Email, Invitation, TenantId } from "@donordesk/domain";

const tenantId = TenantId.create("tenant-a");
const ctxOf = (role) => ({ tenant: { tenantId, userId: "u", role }, requestId: "r" });
const inv = (id, email, expiresAt) => Invitation.rehydrate({ id, tenantId, createdAt: new Date("2027-01-01"), props: { email: Email.create(email), role: "FIELD_OFFICER", invitedById: "u", token: `tok en/${id}`, expiresAt: new Date(expiresAt), projectIds: [] } });

test("an admin sees who has not accepted yet, with the link to share; expired ones are marked", async () => {
  const handler = new ListPendingInvitationsHandler(
    { listOpenByTenant: async () => ({ ok: true, value: [inv("1", "a@x.org", "2027-02-01"), inv("2", "b@x.org", "2026-12-01")] }) },
    () => new Date("2027-01-15"),
  );
  const out = await handler.handle(ctxOf("ADMIN"));
  assert.equal(out.ok, true);
  assert.deepEqual(out.value.map((v) => [v.email, v.expired]), [["a@x.org", false], ["b@x.org", true]]);
  assert.equal(out.value[0].acceptPath, "/invite/accept?token=tok%20en%2F1");
});

test("someone who may not manage users cannot read the acceptance links", async () => {
  const handler = new ListPendingInvitationsHandler({ listOpenByTenant: async () => ({ ok: true, value: [] }) });
  await assert.rejects(() => handler.handle(ctxOf("FIELD_OFFICER")));
});
