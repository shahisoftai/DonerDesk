import assert from "node:assert/strict";
import test from "node:test";
import { auditTenantId, PLATFORM_AUDIT_TENANT } from "../dist/audit/verify-tenants.js";

test("the platform pseudo-tenant is readable by the audit verifier", () => {
  assert.equal(auditTenantId(PLATFORM_AUDIT_TENANT).toString(), "*");
});

test("an ordinary tenant id is validated as before", () => {
  const id = "473eec41-2da1-452e-9fc7-4d91f6403ffd";
  assert.equal(auditTenantId(id).toString(), id);
});

test("any other invalid tenant id still throws", () => {
  assert.throws(() => auditTenantId("a b"), /TenantId/);
  assert.throws(() => auditTenantId(""), /TenantId/);
});
