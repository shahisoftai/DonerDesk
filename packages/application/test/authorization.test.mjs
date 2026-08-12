import assert from "node:assert/strict";
import test from "node:test";
import { ChangeRoleHandler } from "../dist/index.js";
import { TenantId } from "@donordesk/domain";

test("change-role handler denies non-admin callers before repository access", async () => {
  let accessed = false;
  const users = { findById: async () => { accessed = true; return { ok: true, value: null }; } };
  const handler = new ChangeRoleHandler(users, { record: async () => ({ ok: true, value: undefined }) });
  await assert.rejects(
    () => handler.handle(
      { tenant: { tenantId: TenantId.create("tenant-a"), userId: "viewer", role: "VIEWER" }, requestId: "r-1" },
      { userId: "target", role: "ADMIN" },
    ),
    (error) => error?.code === "FORBIDDEN",
  );
  assert.equal(accessed, false);
});
