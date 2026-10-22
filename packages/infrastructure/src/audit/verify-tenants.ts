import { TenantId } from "@donordesk/domain";

/**
 * Platform jobs (billing reconciliation, contact-sales, trial expiry) write audit events under the pseudo-tenant "*",
 * which `TenantId.create` rejects. Those events form a chain of their own, so the verifier reads it the way the writers
 * record it. Any other id that is not a valid tenant id still throws.
 */
export const PLATFORM_AUDIT_TENANT = "*";

export function auditTenantId(raw: string): TenantId {
  if (raw === PLATFORM_AUDIT_TENANT) return { toString: () => PLATFORM_AUDIT_TENANT } as TenantId;
  return TenantId.create(raw);
}
