import type { TenantId } from "@donordesk/domain";

export interface TenantContext {
  readonly tenantId: TenantId;
  readonly userId: string;
  readonly role: string;
  /** An outside implementing partner (set by the API's auth middleware); absent for organisation members. */
  readonly external?: boolean;
}

export interface AuthenticatedContext {
  tenant: TenantContext;
  ipAddress?: string;
  requestId: string;
}
