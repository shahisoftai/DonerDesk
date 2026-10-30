import { DomainError, MAP_OVERLAYS_PER_ORGANISATION, Permissions, validateOverlay, type Result, type Role } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger, IClock, IIdGenerator } from "../../ports/core.js";
import type { IStorage } from "../../ports/infrastructure.js";
import type { IMapOverlayRepository, StoredMapOverlay } from "../../ports/dashboards.js";

/**
 * The organisation's map overlays (Phase 35, after DevResults' "Map Overlays"): context for a map, kept once and ticked per map. Anyone who can see projects can list and
 * draw them; adding and removing need `project.edit` and are audited. An outside partner draws none (the routes are not on their allow-list).
 */
export interface MapOverlayDto { id: string; name: string; sizeBytes: number; featureCount: number; createdAt: string }
const dto = (o: StoredMapOverlay): MapOverlayDto => ({ id: o.id, name: o.name, sizeBytes: o.sizeBytes, featureCount: o.featureCount, createdAt: o.createdAt.toISOString() });
const ok = <T>(value: T): Result<T, DomainError> => ({ ok: true, value });
const fail = <T>(error: DomainError): Result<T, DomainError> => ({ ok: false, error });
const can = (ctx: AuthenticatedContext, p: Parameters<typeof Permissions.can>[1]) => Permissions.can(ctx.tenant.role as Role, p);
const keyOf = (ctx: AuthenticatedContext, id: string) => `map-overlays/${ctx.tenant.tenantId.toString()}/${id}.json`;

export class ListMapOverlaysHandler {
  constructor(private readonly repo: IMapOverlayRepository) {}
  async handle(ctx: AuthenticatedContext): Promise<Result<{ overlays: MapOverlayDto[]; canEdit: boolean }, DomainError>> {
    if (!can(ctx, "project.view")) return fail(DomainError.forbidden("You cannot see map overlays"));
    const r = await this.repo.list(ctx.tenant.tenantId);
    return r.ok ? ok({ overlays: r.value.map(dto), canEdit: can(ctx, "project.edit") }) : r;
  }
}

export class AddMapOverlayHandler {
  constructor(private readonly ids: IIdGenerator, private readonly storage: IStorage, private readonly repo: IMapOverlayRepository, private readonly audit: IAuditLogger, private readonly clock: IClock) {}
  async handle(ctx: AuthenticatedContext, input: { name: string; geojson: string }): Promise<Result<MapOverlayDto, DomainError>> {
    if (!can(ctx, "project.edit")) return fail(DomainError.forbidden("You cannot add map overlays"));
    const checked = validateOverlay(input.geojson, input.name);
    if (!checked.ok) return checked;
    const mine = await this.repo.list(ctx.tenant.tenantId);
    if (!mine.ok) return mine;
    if (mine.value.length >= MAP_OVERLAYS_PER_ORGANISATION) return fail(DomainError.validation(`You can keep ${MAP_OVERLAYS_PER_ORGANISATION} overlays. Remove one first.`));
    if (mine.value.some((o) => o.name.toLowerCase() === checked.value.name.toLowerCase())) return fail(DomainError.conflict("An overlay with that name already exists. Remove it first or choose another name."));
    const id = this.ids.generate();
    const key = keyOf(ctx, id);
    const body = Buffer.from(checked.value.json, "utf8");
    await this.storage.put({ key, body, contentType: "application/json" });
    const o: StoredMapOverlay = { id, tenantId: ctx.tenant.tenantId, name: checked.value.name, storageKey: key, sizeBytes: body.length, featureCount: checked.value.featureCount, uploadedById: ctx.tenant.userId, createdAt: this.clock.now() };
    const saved = await this.repo.create(o);
    if (!saved.ok) { await this.storage.remove(key).catch(() => undefined); return saved; }
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "map_overlay.added", entityType: "map_overlay", entityId: id, newValue: JSON.stringify({ name: o.name, featureCount: o.featureCount }) });
    return ok(dto(o));
  }
}

export class ReadMapOverlayHandler {
  constructor(private readonly storage: IStorage, private readonly repo: IMapOverlayRepository) {}
  /** The stored GeoJSON, verbatim. */
  async handle(ctx: AuthenticatedContext, id: string): Promise<Result<string, DomainError>> {
    if (!can(ctx, "project.view")) return fail(DomainError.forbidden("You cannot see map overlays"));
    const found = await this.repo.findById(id, ctx.tenant.tenantId);
    if (!found.ok) return found;
    if (!found.value) return fail(DomainError.notFound("Map overlay", id));
    try { return ok((await this.storage.read(found.value.storageKey)).toString("utf8")); } catch { return fail(DomainError.notFound("Map overlay file", id)); }
  }
}

export class RemoveMapOverlayHandler {
  constructor(private readonly storage: IStorage, private readonly repo: IMapOverlayRepository, private readonly audit: IAuditLogger) {}
  async handle(ctx: AuthenticatedContext, id: string): Promise<Result<void, DomainError>> {
    if (!can(ctx, "project.edit")) return fail(DomainError.forbidden("You cannot remove map overlays"));
    const found = await this.repo.findById(id, ctx.tenant.tenantId);
    if (!found.ok) return found;
    if (!found.value) return ok(undefined);
    const gone = await this.repo.delete(id, ctx.tenant.tenantId);
    if (!gone.ok) return gone;
    await this.storage.remove(found.value.storageKey).catch(() => undefined);
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "map_overlay.removed", entityType: "map_overlay", entityId: id, oldValue: JSON.stringify({ name: found.value.name }) });
    return ok(undefined);
  }
}
