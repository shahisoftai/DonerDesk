import {
  DomainError, Permissions, WEBHOOK_EVENTS, bearerApiToken, checkApiKey, checkWebhookData, checkWebhookUrl, err, hashApiToken, isApiScope, isWebhookEvent, newApiToken, ok,
  type ApiKeyRefusal, type ApiScope, type Result, type Role, type WebhookEvent, type WebhookPayload,
} from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger, IClock, IIdGenerator } from "../../ports/core.js";
import type { ApiKeyRecord, IApiKeyRepository, IWebhookRepository, WebhookDeliveryRecord, WebhookEndpointRecord } from "../../ports/integrations.js";

/**
 * Integrations (Phase 33.7): API keys and webhooks, managed by whoever manages the organisation (`org.manage`).
 * Secrets are shown once: a key's token and a webhook's signing secret are in the response that creates them and
 * nowhere else. Everything is audited; nothing here ever carries report text.
 */

const canManage = (ctx: AuthenticatedContext) => Permissions.can(ctx.tenant.role as Role, "org.manage");
const forbidden = () => err(DomainError.forbidden("Only an administrator manages integrations"));

export interface ApiKeyDto {
  id: string;
  name: string;
  prefix: string;
  scopes: ApiScope[];
  projectIds: string[];
  expiresAt?: string;
  revokedAt?: string;
  lastUsedAt?: string;
  createdAt: string;
  status: "ACTIVE" | "REVOKED" | "EXPIRED";
}

function keyDto(k: ApiKeyRecord, now: Date): ApiKeyDto {
  const status = k.revokedAt ? "REVOKED" : k.expiresAt && k.expiresAt.getTime() <= now.getTime() ? "EXPIRED" : "ACTIVE";
  return {
    id: k.id, name: k.name, prefix: k.prefix, scopes: k.scopes, projectIds: k.projectIds, status, createdAt: k.createdAt.toISOString(),
    ...(k.expiresAt ? { expiresAt: k.expiresAt.toISOString() } : {}), ...(k.revokedAt ? { revokedAt: k.revokedAt.toISOString() } : {}), ...(k.lastUsedAt ? { lastUsedAt: k.lastUsedAt.toISOString() } : {}),
  };
}

export class CreateApiKeyHandler {
  constructor(private readonly ids: IIdGenerator, private readonly keys: IApiKeyRepository, private readonly audit: IAuditLogger, private readonly clock: IClock, private readonly randomBytes: (n: number) => Buffer) {}

  async handle(ctx: AuthenticatedContext, input: { name: string; scopes: string[]; projectIds?: string[]; expiresInDays?: number }): Promise<Result<{ key: ApiKeyDto; token: string }, DomainError>> {
    if (!canManage(ctx)) return forbidden();
    const name = input.name.trim();
    if (!name) return err(DomainError.validation("Name the key after what will use it", { field: "name" }));
    const scopes = [...new Set(input.scopes)];
    if (scopes.length === 0 || !scopes.every(isApiScope)) return err(DomainError.validation("Choose at least one thing the key may read", { field: "scopes" }));
    const now = this.clock.now();
    const minted = newApiToken(this.randomBytes);
    const record: ApiKeyRecord = {
      id: this.ids.generate(), tenantId: ctx.tenant.tenantId, name, prefix: minted.prefix, tokenHash: minted.tokenHash, scopes: scopes as ApiScope[],
      projectIds: [...new Set(input.projectIds ?? [])], createdById: ctx.tenant.userId, createdAt: now,
      ...(input.expiresInDays ? { expiresAt: new Date(now.getTime() + input.expiresInDays * 86_400_000) } : {}),
    };
    const saved = await this.keys.create(record);
    if (!saved.ok) return saved;
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "api_key.created", entityType: "api_key", entityId: record.id, newValue: JSON.stringify({ name, scopes, projects: record.projectIds.length }) });
    return ok({ key: keyDto(record, now), token: minted.token });
  }
}

export class ListApiKeysHandler {
  constructor(private readonly keys: IApiKeyRepository, private readonly clock: IClock) {}

  async handle(ctx: AuthenticatedContext): Promise<Result<ApiKeyDto[], DomainError>> {
    if (!canManage(ctx)) return forbidden();
    const listed = await this.keys.listByTenant(ctx.tenant.tenantId);
    if (!listed.ok) return listed;
    const now = this.clock.now();
    return ok(listed.value.map((k) => keyDto(k, now)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }
}

export class RevokeApiKeyHandler {
  constructor(private readonly keys: IApiKeyRepository, private readonly audit: IAuditLogger, private readonly clock: IClock) {}

  async handle(ctx: AuthenticatedContext, id: string): Promise<Result<void, DomainError>> {
    if (!canManage(ctx)) return forbidden();
    const done = await this.keys.revoke(id, ctx.tenant.tenantId, this.clock.now());
    if (!done.ok) return done;
    if (!done.value) return err(DomainError.notFound("API key", id));
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "api_key.revoked", entityType: "api_key", entityId: id });
    return ok(undefined);
  }
}

export interface ApiKeyPrincipal {
  keyId: string;
  tenantId: ApiKeyRecord["tenantId"];
  name: string;
  scopes: ApiScope[];
  projectIds: string[];
}

/**
 * Turns an `Authorization` header into a key principal for one request, or a refusal. The refusal says only "not
 * allowed" outwards (the route answers 401 or 403); the reason is for logs and tests.
 */
export class ApiKeyAuthenticator {
  constructor(private readonly keys: IApiKeyRepository, private readonly clock: IClock) {}

  async authenticate(header: string | undefined, need: { scope: ApiScope; projectId?: string }): Promise<{ ok: true; principal: ApiKeyPrincipal } | { ok: false; status: 401 | 403; reason: ApiKeyRefusal | "NO_TOKEN" | "UNKNOWN" }> {
    const token = bearerApiToken(header);
    if (!token) return { ok: false, status: 401, reason: "NO_TOKEN" };
    const found = await this.keys.findByTokenHash(hashApiToken(token));
    if (!found.ok || !found.value) return { ok: false, status: 401, reason: "UNKNOWN" };
    const key = found.value;
    const now = this.clock.now();
    const refusal = checkApiKey(key, need, now);
    if (refusal === "REVOKED" || refusal === "EXPIRED") return { ok: false, status: 401, reason: refusal };
    if (refusal) return { ok: false, status: 403, reason: refusal };
    await this.keys.touch(key.id, now);
    return { ok: true, principal: { keyId: key.id, tenantId: key.tenantId, name: key.name, scopes: key.scopes, projectIds: key.projectIds } };
  }
}

export interface WebhookEndpointDto {
  id: string;
  url: string;
  events: WebhookEvent[];
  enabled: boolean;
  disabledReason?: string;
  consecutiveFailures: number;
  createdAt: string;
}

const endpointDto = (e: WebhookEndpointRecord): WebhookEndpointDto => ({
  id: e.id, url: e.url, events: e.events, enabled: e.enabled, consecutiveFailures: e.consecutiveFailures, createdAt: e.createdAt.toISOString(),
  ...(e.disabledReason ? { disabledReason: e.disabledReason } : {}),
});

function checkEvents(events: string[]): Result<WebhookEvent[], DomainError> {
  const unique = [...new Set(events)];
  if (unique.length === 0 || !unique.every(isWebhookEvent)) return err(DomainError.validation(`Choose what to be told about (${WEBHOOK_EVENTS.length} choices)`, { field: "events" }));
  return ok(unique as WebhookEvent[]);
}

export class CreateWebhookEndpointHandler {
  constructor(private readonly ids: IIdGenerator, private readonly hooks: IWebhookRepository, private readonly audit: IAuditLogger, private readonly clock: IClock, private readonly randomBytes: (n: number) => Buffer) {}

  async handle(ctx: AuthenticatedContext, input: { url: string; events: string[] }): Promise<Result<{ endpoint: WebhookEndpointDto; secret: string }, DomainError>> {
    if (!canManage(ctx)) return forbidden();
    const url = checkWebhookUrl(input.url);
    if (!url.ok) return url;
    const events = checkEvents(input.events);
    if (!events.ok) return events;
    const secret = `whsec_${this.randomBytes(24).toString("base64url")}`;
    const record: WebhookEndpointRecord = { id: this.ids.generate(), tenantId: ctx.tenant.tenantId, url: url.value.toString(), secret, events: events.value, enabled: true, consecutiveFailures: 0, createdById: ctx.tenant.userId, createdAt: this.clock.now() };
    const saved = await this.hooks.createEndpoint(record);
    if (!saved.ok) return saved;
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "webhook.created", entityType: "webhook", entityId: record.id, newValue: JSON.stringify({ host: url.value.hostname, events: events.value }) });
    return ok({ endpoint: endpointDto(record), secret });
  }
}

export class ListWebhookEndpointsHandler {
  constructor(private readonly hooks: IWebhookRepository) {}

  async handle(ctx: AuthenticatedContext): Promise<Result<WebhookEndpointDto[], DomainError>> {
    if (!canManage(ctx)) return forbidden();
    const listed = await this.hooks.listEndpoints(ctx.tenant.tenantId);
    if (!listed.ok) return listed;
    return ok(listed.value.map(endpointDto));
  }
}

export class UpdateWebhookEndpointHandler {
  constructor(private readonly hooks: IWebhookRepository, private readonly audit: IAuditLogger) {}

  /** Change what it listens to, or switch it on again after it was switched off (which also clears its failure count). */
  async handle(ctx: AuthenticatedContext, id: string, input: { events?: string[]; enabled?: boolean }): Promise<Result<void, DomainError>> {
    if (!canManage(ctx)) return forbidden();
    const found = await this.hooks.findEndpoint(id, ctx.tenant.tenantId);
    if (!found.ok) return found;
    if (!found.value) return err(DomainError.notFound("Webhook", id));
    const next = { ...found.value };
    if (input.events) {
      const events = checkEvents(input.events);
      if (!events.ok) return events;
      next.events = events.value;
    }
    if (input.enabled !== undefined) {
      next.enabled = input.enabled;
      if (input.enabled) { next.consecutiveFailures = 0; next.disabledReason = undefined; }
    }
    const saved = await this.hooks.updateEndpoint(next);
    if (!saved.ok) return saved;
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "webhook.updated", entityType: "webhook", entityId: id, newValue: JSON.stringify(input) });
    return ok(undefined);
  }
}

export class DeleteWebhookEndpointHandler {
  constructor(private readonly hooks: IWebhookRepository, private readonly audit: IAuditLogger) {}

  async handle(ctx: AuthenticatedContext, id: string): Promise<Result<void, DomainError>> {
    if (!canManage(ctx)) return forbidden();
    const done = await this.hooks.deleteEndpoint(id, ctx.tenant.tenantId);
    if (!done.ok) return done;
    if (!done.value) return err(DomainError.notFound("Webhook", id));
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "webhook.deleted", entityType: "webhook", entityId: id });
    return ok(undefined);
  }
}

export interface WebhookDeliveryDto {
  id: string;
  event: string;
  status: string;
  attempts: number;
  statusCode?: number;
  error?: string;
  createdAt: string;
}

export class ListWebhookDeliveriesHandler {
  constructor(private readonly hooks: IWebhookRepository) {}

  async handle(ctx: AuthenticatedContext, endpointId: string): Promise<Result<WebhookDeliveryDto[], DomainError>> {
    if (!canManage(ctx)) return forbidden();
    const found = await this.hooks.findEndpoint(endpointId, ctx.tenant.tenantId);
    if (!found.ok) return found;
    if (!found.value) return err(DomainError.notFound("Webhook", endpointId));
    const rows = await this.hooks.recentDeliveries(ctx.tenant.tenantId, endpointId, 25);
    if (!rows.ok) return rows;
    return ok(rows.value.map((d) => ({ id: d.id, event: d.event, status: d.status, attempts: d.attempts, createdAt: d.createdAt.toISOString(), ...(d.lastStatusCode ? { statusCode: d.lastStatusCode } : {}), ...(d.lastError ? { error: d.lastError } : {}) })));
  }
}

/**
 * Where the rest of the system says "this happened". Queues one delivery per subscribed endpoint and returns; it
 * never sends, never throws and never blocks the change that caused it. The payload is checked: ids and simple
 * values only.
 */
export class WebhookDispatcher {
  constructor(private readonly hooks: IWebhookRepository, private readonly ids: IIdGenerator, private readonly clock: IClock, private readonly onError?: (error: unknown) => void) {}

  async emit(tenantId: AuthenticatedContext["tenant"]["tenantId"], event: WebhookEvent, data: Record<string, unknown>): Promise<void> {
    try {
      const checked = checkWebhookData(data);
      if (!checked.ok) { this.onError?.(checked.error); return; }
      const subs = await this.hooks.subscribersOf(tenantId, event);
      if (!subs.ok || subs.value.length === 0) return;
      const now = this.clock.now();
      const eventId = this.ids.generate();
      const payload: WebhookPayload = { id: eventId, event, occurredAt: now.toISOString(), tenant: tenantId.toString(), data: checked.value };
      const json = JSON.stringify(payload);
      const rows: WebhookDeliveryRecord[] = subs.value.map((e) => ({
        id: this.ids.generate(), tenantId, endpointId: e.id, eventId, event, payloadJson: json, status: "PENDING", attempts: 0, nextAttemptAt: now, createdAt: now,
      }));
      await this.hooks.enqueue(rows);
    } catch (error) {
      this.onError?.(error);
    }
  }
}

export interface ApiProjectDto {
  id: string;
  code: string;
  title: string;
  donor: string;
  country: string;
  sector: string;
  status: string;
  startDate: string;
  endDate: string;
}

/** The public API's project list: only what the key may see (its own projects, or all when it names none). Read-only. */
export class ListApiProjectsHandler {
  constructor(private readonly projects: { listByTenant(tenantId: AuthenticatedContext["tenant"]["tenantId"]): Promise<Result<Array<{ id: string; projectCode: string; title: string; donorName: string; country: string; sector: string; status: string; duration: { start: Date; end: Date }; archivedAt?: Date | null }>>> }) {}

  async handle(tenantId: AuthenticatedContext["tenant"]["tenantId"], projectIds: readonly string[]): Promise<Result<ApiProjectDto[], DomainError>> {
    const all = await this.projects.listByTenant(tenantId);
    if (!all.ok) return all;
    return ok(all.value
      .filter((p) => !p.archivedAt && (projectIds.length === 0 || projectIds.includes(p.id)))
      .map((p) => ({ id: p.id, code: p.projectCode, title: p.title, donor: p.donorName, country: p.country, sector: p.sector, status: p.status, startDate: p.duration.start.toISOString().slice(0, 10), endDate: p.duration.end.toISOString().slice(0, 10) })));
  }
}
