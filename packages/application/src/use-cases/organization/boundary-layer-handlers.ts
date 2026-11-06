import { randomUUID } from "node:crypto";
import { BOUNDARY_LAYER_MAX_LAYERS, DomainError, Permissions, err, ok, validateBoundaryLayer, type Result, type Role, type TenantId } from "@donordesk/domain";
import type { UploadBoundaryLayerFields } from "@donordesk/contracts";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger } from "../../ports/core.js";
import type { IStorage } from "../../ports/infrastructure.js";
import type { ITenantBoundaryLayerRepository, TenantBoundaryLayerRecord } from "../../ports/identity.js";

/**
 * Boundary files an organisation uploads for one country and level (Phase 41.7). Uploading and removing are administrator work and
 * audited; every member may read the boundaries their own maps draw. A layer replaces the bundled file for that country and level, for
 * this organisation only; one layer per country and level, a new upload replaces it.
 */
export interface BoundaryLayerMeta {
  iso: string;
  countryName: string;
  adminLevel: number;
  name: string;
  featureCount: number;
  sizeBytes: number;
  /** Whether the file carries codes, so places can be joined to it exactly. */
  hasCodes: boolean;
  uploadedAt: string;
}

export const boundaryLayerKey = (tenantId: TenantId | string, iso: string, level: number): string => `boundary-layers/${tenantId.toString()}/${iso.toUpperCase()}-${level}.json`;

const metaOf = (l: TenantBoundaryLayerRecord): BoundaryLayerMeta => ({
  iso: l.iso, countryName: l.countryName, adminLevel: l.adminLevel, name: l.name, featureCount: l.featureCount, sizeBytes: l.sizeBytes,
  hasCodes: l.pcodeField !== null, uploadedAt: l.updatedAt.toISOString(),
});

export class UploadBoundaryLayerHandler {
  constructor(private readonly storage: IStorage, private readonly layers: ITenantBoundaryLayerRepository, private readonly audit: IAuditLogger, private readonly now: () => Date = () => new Date()) {}

  async handle(ctx: AuthenticatedContext, input: UploadBoundaryLayerFields & { fileName?: string | undefined; buffer: Buffer }): Promise<Result<BoundaryLayerMeta, DomainError>> {
    Permissions.require(ctx.tenant.role as Role, "org.manage");
    const tenantId = ctx.tenant.tenantId;
    const checked = validateBoundaryLayer(input.buffer.toString("utf8"), {
      iso: input.iso, countryName: input.countryName, adminLevel: input.adminLevel, fileName: input.fileName,
      nameField: input.nameField, pcodeField: input.pcodeField, parentPcodeField: input.parentPcodeField,
    });
    if (!checked.ok) return checked;
    const layer = checked.value;
    const all = await this.layers.list(tenantId);
    const existing = all.find((l) => l.iso === layer.iso && l.adminLevel === layer.adminLevel);
    if (!existing && all.length >= BOUNDARY_LAYER_MAX_LAYERS) return err(DomainError.validation(`An organisation keeps at most ${BOUNDARY_LAYER_MAX_LAYERS} boundary files; remove one first`));
    const key = boundaryLayerKey(tenantId, layer.iso, layer.adminLevel);
    await this.storage.put({ key, body: Buffer.from(layer.json, "utf8"), contentType: "application/json" });
    const record: TenantBoundaryLayerRecord = {
      id: existing?.id ?? randomUUID(), tenantId, iso: layer.iso, countryName: layer.countryName, adminLevel: layer.adminLevel, name: layer.name,
      nameField: layer.nameField, pcodeField: layer.pcodeField, parentPcodeField: layer.parentPcodeField, storageKey: key,
      sizeBytes: Buffer.byteLength(layer.json, "utf8"), featureCount: layer.featureCount, uploadedById: ctx.tenant.userId, updatedAt: this.now(),
    };
    await this.layers.save(record);
    await this.audit.record({
      tenantId, actorId: ctx.tenant.userId, eventType: existing ? "boundary_layer.replaced" : "boundary_layer.uploaded", entityType: "boundary_layer", entityId: record.id,
      newValue: JSON.stringify({ iso: record.iso, adminLevel: record.adminLevel, name: record.name, featureCount: record.featureCount, hasCodes: record.pcodeField !== null }),
    });
    return ok(metaOf(record));
  }
}

export class ListBoundaryLayersHandler {
  constructor(private readonly layers: ITenantBoundaryLayerRepository) {}

  async handle(ctx: AuthenticatedContext): Promise<Result<BoundaryLayerMeta[], DomainError>> {
    Permissions.require(ctx.tenant.role as Role, "project.view");
    const all = await this.layers.list(ctx.tenant.tenantId);
    return ok(all.map(metaOf).sort((a, b) => a.countryName.localeCompare(b.countryName) || a.adminLevel - b.adminLevel));
  }
}

export class ReadBoundaryLayerHandler {
  constructor(private readonly storage: IStorage, private readonly layers: ITenantBoundaryLayerRepository) {}

  /** The stored, normalised GeoJSON verbatim: the route serves it as JSON. */
  async handle(ctx: AuthenticatedContext, iso: string, adminLevel: number): Promise<Result<string, DomainError>> {
    Permissions.require(ctx.tenant.role as Role, "project.view");
    const layer = await this.layers.find(ctx.tenant.tenantId, iso.toUpperCase(), adminLevel);
    if (!layer) return err(DomainError.notFound("Boundary file", `${iso} level ${adminLevel}`));
    try {
      return ok((await this.storage.read(layer.storageKey)).toString("utf8"));
    } catch {
      return err(DomainError.notFound("Boundary file", layer.storageKey));
    }
  }
}

export class RemoveBoundaryLayerHandler {
  constructor(private readonly storage: IStorage, private readonly layers: ITenantBoundaryLayerRepository, private readonly audit: IAuditLogger) {}

  /** Idempotent: removing a layer that is not there is not an error. */
  async handle(ctx: AuthenticatedContext, iso: string, adminLevel: number): Promise<Result<{ removed: boolean }, DomainError>> {
    Permissions.require(ctx.tenant.role as Role, "org.manage");
    const tenantId = ctx.tenant.tenantId;
    const layer = await this.layers.find(tenantId, iso.toUpperCase(), adminLevel);
    if (!layer) return ok({ removed: false });
    await this.layers.remove(tenantId, layer.iso, layer.adminLevel);
    await this.storage.remove(layer.storageKey).catch(() => undefined);
    await this.audit.record({
      tenantId, actorId: ctx.tenant.userId, eventType: "boundary_layer.removed", entityType: "boundary_layer", entityId: layer.id,
      oldValue: JSON.stringify({ iso: layer.iso, adminLevel: layer.adminLevel, name: layer.name, featureCount: layer.featureCount }),
    });
    return ok({ removed: true });
  }
}
