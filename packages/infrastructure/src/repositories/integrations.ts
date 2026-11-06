import { TenantId, ok, type ApiScope, type Result, type WebhookEvent } from "@donordesk/domain";
import type { ApiKeyRecord, IApiKeyRepository, IWebhookRepository, WebhookDeliveryRecord, WebhookEndpointRecord } from "@donordesk/application";
import type { PrismaClient } from "@prisma/client";

type KeyRow = NonNullable<Awaited<ReturnType<PrismaClient["apiKey"]["findFirst"]>>>;
type EndpointRow = NonNullable<Awaited<ReturnType<PrismaClient["webhookEndpoint"]["findFirst"]>>>;
type DeliveryRow = NonNullable<Awaited<ReturnType<PrismaClient["webhookDelivery"]["findFirst"]>>>;

const keyFrom = (r: KeyRow): ApiKeyRecord => ({
  id: r.id, tenantId: TenantId.create(r.tenantId), name: r.name, prefix: r.prefix, tokenHash: r.tokenHash, scopes: r.scopes as ApiScope[], projectIds: r.projectIds,
  expiresAt: r.expiresAt ?? undefined, revokedAt: r.revokedAt ?? undefined, lastUsedAt: r.lastUsedAt ?? undefined, createdById: r.createdById, createdAt: r.createdAt,
});
const endpointFrom = (r: EndpointRow): WebhookEndpointRecord => ({
  id: r.id, tenantId: TenantId.create(r.tenantId), url: r.url, secret: r.secret, events: r.events as WebhookEvent[], enabled: r.enabled,
  disabledReason: r.disabledReason ?? undefined, consecutiveFailures: r.consecutiveFailures, createdById: r.createdById, createdAt: r.createdAt,
});
const deliveryFrom = (r: DeliveryRow): WebhookDeliveryRecord => ({
  id: r.id, tenantId: TenantId.create(r.tenantId), endpointId: r.endpointId, eventId: r.eventId, event: r.event as WebhookEvent, payloadJson: r.payloadJson,
  status: r.status as WebhookDeliveryRecord["status"], attempts: r.attempts, nextAttemptAt: r.nextAttemptAt, lastStatusCode: r.lastStatusCode ?? undefined,
  lastError: r.lastError ?? undefined, deliveredAt: r.deliveredAt ?? undefined, createdAt: r.createdAt,
});

export class PrismaApiKeyRepository implements IApiKeyRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(k: ApiKeyRecord): Promise<Result<void>> {
    await this.prisma.apiKey.create({
      data: { id: k.id, tenantId: k.tenantId.toString(), name: k.name, prefix: k.prefix, tokenHash: k.tokenHash, scopes: k.scopes, projectIds: k.projectIds, expiresAt: k.expiresAt ?? null, createdById: k.createdById },
    });
    return ok(undefined);
  }
  async listByTenant(tenantId: TenantId): Promise<Result<ApiKeyRecord[]>> {
    return ok((await this.prisma.apiKey.findMany({ where: { tenantId: tenantId.toString() }, orderBy: { createdAt: "desc" } })).map(keyFrom));
  }
  async findByTokenHash(tokenHash: string): Promise<Result<ApiKeyRecord | null>> {
    const row = await this.prisma.apiKey.findUnique({ where: { tokenHash } });
    return ok(row ? keyFrom(row) : null);
  }
  async revoke(id: string, tenantId: TenantId, at: Date): Promise<Result<boolean>> {
    const r = await this.prisma.apiKey.updateMany({ where: { id, tenantId: tenantId.toString(), revokedAt: null }, data: { revokedAt: at } });
    return ok(r.count === 1);
  }
  async touch(id: string, at: Date): Promise<void> {
    await this.prisma.apiKey.updateMany({ where: { id }, data: { lastUsedAt: at } });
  }
}

export class PrismaWebhookRepository implements IWebhookRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createEndpoint(e: WebhookEndpointRecord): Promise<Result<void>> {
    await this.prisma.webhookEndpoint.create({ data: { id: e.id, tenantId: e.tenantId.toString(), url: e.url, secret: e.secret, events: e.events, enabled: e.enabled, createdById: e.createdById } });
    return ok(undefined);
  }
  async listEndpoints(tenantId: TenantId): Promise<Result<WebhookEndpointRecord[]>> {
    return ok((await this.prisma.webhookEndpoint.findMany({ where: { tenantId: tenantId.toString() }, orderBy: { createdAt: "asc" } })).map(endpointFrom));
  }
  async findEndpoint(id: string, tenantId: TenantId): Promise<Result<WebhookEndpointRecord | null>> {
    const row = await this.prisma.webhookEndpoint.findFirst({ where: { id, tenantId: tenantId.toString() } });
    return ok(row ? endpointFrom(row) : null);
  }
  /** Writes every mutable field, `?? null` so a cleared reason is cleared. */
  async updateEndpoint(e: WebhookEndpointRecord): Promise<Result<void>> {
    await this.prisma.webhookEndpoint.updateMany({
      where: { id: e.id, tenantId: e.tenantId.toString() },
      data: { events: e.events, enabled: e.enabled, disabledReason: e.disabledReason ?? null, consecutiveFailures: e.consecutiveFailures },
    });
    return ok(undefined);
  }
  async deleteEndpoint(id: string, tenantId: TenantId): Promise<Result<boolean>> {
    const r = await this.prisma.webhookEndpoint.deleteMany({ where: { id, tenantId: tenantId.toString() } });
    if (r.count === 1) await this.prisma.webhookDelivery.deleteMany({ where: { endpointId: id, tenantId: tenantId.toString() } });
    return ok(r.count === 1);
  }
  async subscribersOf(tenantId: TenantId, event: WebhookEvent): Promise<Result<WebhookEndpointRecord[]>> {
    const rows = await this.prisma.webhookEndpoint.findMany({ where: { tenantId: tenantId.toString(), enabled: true, events: { has: event } } });
    return ok(rows.map(endpointFrom));
  }
  async enqueue(deliveries: WebhookDeliveryRecord[]): Promise<Result<void>> {
    await this.prisma.webhookDelivery.createMany({
      data: deliveries.map((d) => ({ id: d.id, tenantId: d.tenantId.toString(), endpointId: d.endpointId, eventId: d.eventId, event: d.event, payloadJson: d.payloadJson, status: d.status, attempts: d.attempts, nextAttemptAt: d.nextAttemptAt })),
    });
    return ok(undefined);
  }
  async recentDeliveries(tenantId: TenantId, endpointId: string, limit: number): Promise<Result<WebhookDeliveryRecord[]>> {
    return ok((await this.prisma.webhookDelivery.findMany({ where: { tenantId: tenantId.toString(), endpointId }, orderBy: { createdAt: "desc" }, take: limit })).map(deliveryFrom));
  }
  async claimDue(now: Date, limit: number, leaseSeconds: number): Promise<Array<{ delivery: WebhookDeliveryRecord; endpoint: WebhookEndpointRecord | null }>> {
    const rows = await this.prisma.webhookDelivery.findMany({ where: { status: "PENDING", nextAttemptAt: { lte: now } }, orderBy: { nextAttemptAt: "asc" }, take: limit });
    const lease = new Date(now.getTime() + leaseSeconds * 1000);
    const out: Array<{ delivery: WebhookDeliveryRecord; endpoint: WebhookEndpointRecord | null }> = [];
    for (const row of rows) {
      // Only the runner whose update matches takes it (a second runner finds nextAttemptAt already moved).
      const taken = await this.prisma.webhookDelivery.updateMany({ where: { id: row.id, nextAttemptAt: row.nextAttemptAt, status: "PENDING" }, data: { nextAttemptAt: lease } });
      if (taken.count !== 1) continue;
      const endpoint = await this.prisma.webhookEndpoint.findFirst({ where: { id: row.endpointId, tenantId: row.tenantId } });
      out.push({ delivery: deliveryFrom(row), endpoint: endpoint ? endpointFrom(endpoint) : null });
    }
    return out;
  }
  async recordAttempt(a: Parameters<IWebhookRepository["recordAttempt"]>[0]): Promise<void> {
    await this.prisma.webhookDelivery.update({
      where: { id: a.deliveryId },
      data: { status: a.status, attempts: a.attempts, nextAttemptAt: a.nextAttemptAt, lastStatusCode: a.statusCode ?? null, lastError: a.error ?? null, deliveredAt: a.deliveredAt ?? null },
    });
    if (a.endpointFailed) {
      await this.prisma.webhookEndpoint.updateMany({
        where: { id: a.endpointId },
        data: { consecutiveFailures: { increment: 1 }, ...(a.disable ? { enabled: false, disabledReason: a.disable } : {}) },
      });
    } else if (a.status === "DELIVERED") {
      await this.prisma.webhookEndpoint.updateMany({ where: { id: a.endpointId }, data: { consecutiveFailures: 0 } });
    }
  }
}
