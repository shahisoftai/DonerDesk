import type { ApiScope, Result, TenantId, WebhookEvent } from "@donordesk/domain";

export interface ApiKeyRecord {
  id: string;
  tenantId: TenantId;
  name: string;
  prefix: string;
  tokenHash: string;
  scopes: ApiScope[];
  projectIds: string[];
  expiresAt?: Date | undefined;
  revokedAt?: Date | undefined;
  lastUsedAt?: Date | undefined;
  createdById: string;
  createdAt: Date;
}

export interface IApiKeyRepository {
  create(key: ApiKeyRecord): Promise<Result<void>>;
  listByTenant(tenantId: TenantId): Promise<Result<ApiKeyRecord[]>>;
  /** Looked up on the admin connection: the caller does not yet know its organisation. */
  findByTokenHash(tokenHash: string): Promise<Result<ApiKeyRecord | null>>;
  revoke(id: string, tenantId: TenantId, at: Date): Promise<Result<boolean>>;
  touch(id: string, at: Date): Promise<void>;
}

export interface WebhookEndpointRecord {
  id: string;
  tenantId: TenantId;
  url: string;
  secret: string;
  events: WebhookEvent[];
  enabled: boolean;
  disabledReason?: string | undefined;
  consecutiveFailures: number;
  createdById: string;
  createdAt: Date;
}

export interface WebhookDeliveryRecord {
  id: string;
  tenantId: TenantId;
  endpointId: string;
  eventId: string;
  event: WebhookEvent;
  payloadJson: string;
  status: "PENDING" | "DELIVERED" | "FAILED";
  attempts: number;
  nextAttemptAt: Date;
  lastStatusCode?: number | undefined;
  lastError?: string | undefined;
  deliveredAt?: Date | undefined;
  createdAt: Date;
}

export interface IWebhookRepository {
  createEndpoint(endpoint: WebhookEndpointRecord): Promise<Result<void>>;
  listEndpoints(tenantId: TenantId): Promise<Result<WebhookEndpointRecord[]>>;
  findEndpoint(id: string, tenantId: TenantId): Promise<Result<WebhookEndpointRecord | null>>;
  updateEndpoint(endpoint: WebhookEndpointRecord): Promise<Result<void>>;
  deleteEndpoint(id: string, tenantId: TenantId): Promise<Result<boolean>>;
  /** Endpoints of an organisation that are on and subscribed to the event. */
  subscribersOf(tenantId: TenantId, event: WebhookEvent): Promise<Result<WebhookEndpointRecord[]>>;
  enqueue(deliveries: WebhookDeliveryRecord[]): Promise<Result<void>>;
  recentDeliveries(tenantId: TenantId, endpointId: string, limit: number): Promise<Result<WebhookDeliveryRecord[]>>;
  /** Pending deliveries due now, across organisations (the runner's admin connection). Claimed by pushing `nextAttemptAt` out so a second runner skips them. */
  claimDue(now: Date, limit: number, leaseSeconds: number): Promise<Array<{ delivery: WebhookDeliveryRecord; endpoint: WebhookEndpointRecord | null }>>;
  recordAttempt(args: {
    deliveryId: string; status: "PENDING" | "DELIVERED" | "FAILED"; attempts: number; nextAttemptAt: Date; statusCode?: number | undefined; error?: string | undefined; deliveredAt?: Date | undefined;
    endpointId: string; endpointFailed: boolean; disable?: string | undefined;
  }): Promise<void>;
}
