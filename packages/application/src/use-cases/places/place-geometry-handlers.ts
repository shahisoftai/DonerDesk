import { DomainError, PlaceRegistry, err, ok, validateGeometry, validatePlace, type PlaceGeometry, type PlaceRecord, type Result } from "@donordesk/domain";
import type { SetPlaceGeometryInput } from "@donordesk/contracts";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger } from "../../ports/core.js";
import type { IStorage } from "../../ports/infrastructure.js";
import type { IPlaceRepository, StoredPlace } from "../../ports/places.js";
import { canEdit, canView, forbidden, loadAll, toRecord } from "./place-support.js";

/**
 * The outline or route of an area (Phase 41.6). The shape is a GeoJSON file in the tenant's storage; the place row holds only its kind,
 * where the file is and how big it is. The shape is checked by the domain's `validateGeometry` (the same function the browser runs).
 */
export const placeGeometryKey = (tenantId: string, placeId: string): string => `places/${tenantId}/${placeId}.geojson`;

async function livePlace(repo: IPlaceRepository, ctx: AuthenticatedContext, id: string): Promise<Result<{ place: StoredPlace; all: PlaceRecord[] }, DomainError>> {
  const loaded = await loadAll(repo, ctx, true);
  if (!loaded.ok) return loaded;
  const place = loaded.value.stored.find((p) => p.id === id);
  if (!place) return err(DomainError.notFound("Place", id));
  if (place.archived || place.archivedAt) return err(DomainError.validation(`Bring ${place.name} back before changing its outline`));
  return ok({ place, all: loaded.value.stored.map(toRecord) });
}

export class SetPlaceGeometryHandler {
  constructor(private readonly repo: IPlaceRepository, private readonly storage: IStorage, private readonly audit: IAuditLogger) {}

  async handle(ctx: AuthenticatedContext, placeId: string, input: SetPlaceGeometryInput): Promise<Result<{ kind: "POLYGON" | "LINE"; vertices: number }, DomainError>> {
    if (!canEdit(ctx)) return forbidden();
    const found = await livePlace(this.repo, ctx, placeId);
    if (!found.ok) return found;
    const checked = validateGeometry(input.geometry);
    if (!checked.ok) return checked;
    const { place, all } = found.value;
    const key = placeGeometryKey(ctx.tenant.tenantId.toString(), place.id);
    const record: PlaceRecord = { ...toRecord(place), geometryKind: checked.value.kind, geometryKey: key, geometryBytes: checked.value.bytes, placedBy: "MAP_DRAWN" };
    const valid = validatePlace(record, all);
    if (!valid.ok) return valid;
    await this.storage.put({ key, body: Buffer.from(checked.value.json, "utf8"), contentType: "application/geo+json" });
    const saved = await this.repo.update({ ...valid.value, tenantId: place.tenantId, createdById: place.createdById });
    if (!saved.ok) return saved;
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "place.geometry_set", entityType: "place", entityId: place.id, newValue: JSON.stringify({ kind: checked.value.kind, vertices: checked.value.vertices, bytes: checked.value.bytes }) });
    return ok({ kind: checked.value.kind, vertices: checked.value.vertices });
  }
}

export class ClearPlaceGeometryHandler {
  constructor(private readonly repo: IPlaceRepository, private readonly storage: IStorage, private readonly audit: IAuditLogger) {}

  /** Idempotent: a place with no shape is already clear. */
  async handle(ctx: AuthenticatedContext, placeId: string): Promise<Result<void, DomainError>> {
    if (!canEdit(ctx)) return forbidden();
    const found = await livePlace(this.repo, ctx, placeId);
    if (!found.ok) return found;
    const { place } = found.value;
    if (!place.geometryKind) return ok(undefined);
    const { geometryKind: _k, geometryKey: key, geometryBytes: _b, ...rest } = place;
    const left: StoredPlace = rest;
    // With no pin and no shape left there is nothing for "how it was placed" to describe.
    if (left.latitude === undefined) delete left.placedBy;
    const saved = await this.repo.update(left);
    if (!saved.ok) return saved;
    // The row is the truth: a file that outlives it is harmless, so a failed removal never undoes the change.
    if (key) await this.storage.remove(key).catch(() => undefined);
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "place.geometry_cleared", entityType: "place", entityId: place.id });
    return ok(undefined);
  }
}

export class GetPlaceGeometryHandler {
  constructor(private readonly repo: IPlaceRepository, private readonly storage: IStorage) {}

  async handle(ctx: AuthenticatedContext, placeId: string): Promise<Result<{ kind: "POLYGON" | "LINE"; geometry: PlaceGeometry }, DomainError>> {
    if (!canView(ctx)) return err(DomainError.forbidden("You cannot see places"));
    const found = await this.repo.findById(placeId, ctx.tenant.tenantId);
    if (!found.ok) return found;
    const place = found.value;
    if (!place) return err(DomainError.notFound("Place", placeId));
    if (!place.geometryKind || !place.geometryKey) return err(DomainError.notFound("Outline", placeId));
    try {
      const feature = JSON.parse((await this.storage.read(place.geometryKey)).toString("utf8")) as { geometry?: unknown };
      const checked = validateGeometry(feature.geometry);
      if (!checked.ok) return err(DomainError.notFound("Outline", placeId));
      return ok({ kind: checked.value.kind, geometry: checked.value.geometry });
    } catch {
      return err(DomainError.notFound("Outline", placeId));
    }
  }
}
