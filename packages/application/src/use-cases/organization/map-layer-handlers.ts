import { randomUUID } from "node:crypto";
import type { Result } from "@donordesk/domain";
import { DomainError, Permissions, validateMapLayer, err, type Role, type TenantId } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger } from "../../ports/core.js";
import type { IStorage } from "../../ports/infrastructure.js";
import type { ITenantMapLayerRepository, TenantMapLayerRecord } from "../../ports/identity.js";

/**
 * The workspace's own map boundaries (Phase 30.1): one GeoJSON layer per organisation that the site
 * map draws instead of the bundled country and province outlines — how district and sub-district
 * polygons get in. One layer; a new upload replaces the old one. Uploads and removals are
 * administrator-only and audited; every member may read the boundaries their own maps draw.
 */

export interface MapLayerMeta {
  name: string;
  sizeBytes: number;
  featureCount: number;
  uploadedAt: string;
}

function mapKey(tenantId: TenantId): string {
  return `map-layers/${tenantId.toString()}.json`;
}

export class UploadMapLayerHandler {
  constructor(private readonly storage: IStorage, private readonly layers: ITenantMapLayerRepository, private readonly audit: IAuditLogger) {}

  async handle(ctx: AuthenticatedContext, input: { fileName?: string; buffer: Buffer }): Promise<Result<MapLayerMeta, DomainError>> {
    Permissions.require(ctx.tenant.role as Role, "org.manage");
    const tenantId = ctx.tenant.tenantId;
    const validated = validateMapLayer(input.buffer.toString("utf8"), { fileName: input.fileName });
    if (!validated.ok) return validated;
    const key = mapKey(tenantId);
    await this.storage.put({ key, body: Buffer.from(validated.value.json, "utf8"), contentType: "application/json" });
    const existing = await this.layers.findByTenant(tenantId);
    const record: TenantMapLayerRecord = {
      id: existing?.id ?? randomUUID(),
      tenantId,
      name: validated.value.name,
      storageKey: key,
      sizeBytes: Buffer.byteLength(validated.value.json, "utf8"),
      featureCount: validated.value.featureCount,
      uploadedById: ctx.tenant.userId,
      updatedAt: new Date(),
    };
    await this.layers.save(record);
    await this.audit.record({
      tenantId,
      actorId: ctx.tenant.userId,
      eventType: existing ? "map_layer.replaced" : "map_layer.uploaded",
      entityType: "map_layer",
      entityId: record.id,
      newValue: JSON.stringify({ name: record.name, featureCount: record.featureCount, sizeBytes: record.sizeBytes }),
    });
    return { ok: true, value: { name: record.name, sizeBytes: record.sizeBytes, featureCount: record.featureCount, uploadedAt: record.updatedAt.toISOString() } };
  }
}

export class GetMapLayerHandler {
  constructor(private readonly layers: ITenantMapLayerRepository) {}

  async handle(ctx: AuthenticatedContext): Promise<Result<MapLayerMeta | null, DomainError>> {
    Permissions.require(ctx.tenant.role as Role, "project.view");
    const layer = await this.layers.findByTenant(ctx.tenant.tenantId);
    if (!layer) return { ok: true, value: null };
    return { ok: true, value: { name: layer.name, sizeBytes: layer.sizeBytes, featureCount: layer.featureCount, uploadedAt: layer.updatedAt.toISOString() } };
  }
}

export class ReadMapLayerHandler {
  constructor(private readonly storage: IStorage, private readonly layers: ITenantMapLayerRepository) {}

  /** The stored GeoJSON verbatim — the route serves it as `application/json`. */
  async handle(ctx: AuthenticatedContext): Promise<Result<string, DomainError>> {
    Permissions.require(ctx.tenant.role as Role, "project.view");
    const layer = await this.layers.findByTenant(ctx.tenant.tenantId);
    if (!layer) return err(DomainError.notFound("Map layer", ctx.tenant.tenantId.toString()));
    try {
      return { ok: true, value: (await this.storage.read(layer.storageKey)).toString("utf8") };
    } catch {
      return err(DomainError.notFound("Map file", layer.storageKey));
    }
  }
}

export class RemoveMapLayerHandler {
  constructor(private readonly storage: IStorage, private readonly layers: ITenantMapLayerRepository, private readonly audit: IAuditLogger) {}

  async handle(ctx: AuthenticatedContext): Promise<Result<{ removed: true }, DomainError>> {
    Permissions.require(ctx.tenant.role as Role, "org.manage");
    const tenantId = ctx.tenant.tenantId;
    const layer = await this.layers.findByTenant(tenantId);
    if (!layer) return { ok: true, value: { removed: true } };
    await this.layers.remove(tenantId);
    await this.storage.remove(layer.storageKey).catch(() => undefined);
    await this.audit.record({
      tenantId,
      actorId: ctx.tenant.userId,
      eventType: "map_layer.removed",
      entityType: "map_layer",
      entityId: layer.id,
      oldValue: JSON.stringify({ name: layer.name, featureCount: layer.featureCount }),
    });
    return { ok: true, value: { removed: true } };
  }
}
