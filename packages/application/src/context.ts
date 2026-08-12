import type { TenantId } from "@donordesk/domain";

export interface TenantContext {
  readonly tenantId: TenantId;
  readonly userId: string;
  readonly role: string;
}

export interface AuthenticatedContext {
  tenant: TenantContext;
  ipAddress?: string;
  requestId: string;
}
