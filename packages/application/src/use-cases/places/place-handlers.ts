import {
  DomainError, Permissions, PlaceRegistry, err, ok, parsePlaceSheet, planBoundarySeed, planPlaceImport, resolvePlace, validatePlace,
  type PlaceRecord, type PlaceResolution, type Result, type Role, type SeedUnit,
} from "@donordesk/domain";
import type { CreatePlaceInput, ImportPlacesInput, ResolvePlacesInput, UpdatePlaceInput } from "@donordesk/contracts";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger, IIdGenerator } from "../../ports/core.js";
import type { IPlaceRepository, IPlaceUsageReader, StoredPlace } from "../../ports/places.js";
import { canEdit, canView, forbidden, loadAll, toRecord } from "./place-support.js";

/**
 * The organisation's list of places (Phase 33.1). Reading is for every member (the entry screens
 * suggest from it); changing it needs `project.edit`, because a place is shared by every project.
 * Every change is audited. A place that has anything inside it is retired only after those are.
 */

export interface PlaceDto {
  id: string;
  name: string;
  kind: "POINT" | "AREA";
  adminLevel: number;
  parentId?: string;
  /** "Rabak › White Nile › Sudan". */
  path: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  aliases: string[];
  facility?: boolean;
  code?: string;
  /** "POLYGON" (an outline) or "LINE" (a route) when a shape is stored; the shape itself is read from its own route. */
  geometryKind?: "POLYGON" | "LINE";
  placedBy?: string;
  archived: boolean;
  /** How many live places sit directly inside it. */
  childCount: number;
}

function toDto(p: StoredPlace, registry: PlaceRegistry): PlaceDto {
  const live = !p.archived && p.archivedAt === undefined;
  return {
    id: p.id, name: p.name, kind: p.kind, adminLevel: p.adminLevel, ...(p.parentId ? { parentId: p.parentId } : {}),
    path: live ? registry.pathLabel(p.id) : p.name,
    ...(p.country ? { country: p.country } : {}), ...(p.latitude !== undefined ? { latitude: p.latitude, longitude: p.longitude } : {}),
    aliases: p.aliases, ...(p.code ? { code: p.code } : {}), ...(p.facility ? { facility: true } : {}), ...(p.geometryKind ? { geometryKind: p.geometryKind } : {}), ...(p.placedBy ? { placedBy: p.placedBy } : {}), archived: !live, childCount: live ? registry.childrenOf(p.id).length : 0,
  };
}

export class ListPlacesHandler {
  constructor(private readonly repo: IPlaceRepository) {}

  async handle(ctx: AuthenticatedContext, options: { includeArchived?: boolean } = {}): Promise<Result<{ places: PlaceDto[]; canEdit: boolean }, DomainError>> {
    if (!canView(ctx)) return err(DomainError.forbidden("You cannot see places"));
    const all = await loadAll(this.repo, ctx, options.includeArchived);
    if (!all.ok) return all;
    const places = all.value.stored
      .map((p) => toDto(p, all.value.registry))
      .sort((a, b) => a.path.localeCompare(b.path));
    return ok({ places, canEdit: canEdit(ctx) });
  }
}

export class CreatePlaceHandler {
  constructor(private readonly ids: IIdGenerator, private readonly repo: IPlaceRepository, private readonly audit: IAuditLogger) {}

  async handle(ctx: AuthenticatedContext, input: CreatePlaceInput): Promise<Result<{ id: string }, DomainError>> {
    if (!canEdit(ctx)) return forbidden();
    const all = await loadAll(this.repo, ctx);
    if (!all.ok) return all;
    const kind = input.latitude !== undefined ? "POINT" : input.kind;
    const record: PlaceRecord = {
      id: this.ids.generate(), name: input.name, kind, adminLevel: input.adminLevel as PlaceRecord["adminLevel"],
      ...(input.parentId ? { parentId: input.parentId } : {}), ...(input.country ? { country: input.country } : {}),
      ...(input.latitude !== undefined ? { latitude: input.latitude } : {}), ...(input.longitude !== undefined ? { longitude: input.longitude } : {}),
      aliases: input.aliases, ...(input.code ? { code: input.code } : {}), ...(input.facility ? { facility: true } : {}), ...(input.placedBy ? { placedBy: input.placedBy } : {}), archived: false,
    };
    const valid = validatePlace(record, all.value.stored.map(toRecord));
    if (!valid.ok) return valid;
    const saved = await this.repo.createMany([{ ...valid.value, tenantId: ctx.tenant.tenantId, createdById: ctx.tenant.userId }]);
    if (!saved.ok) return saved;
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "place.created", entityType: "place", entityId: record.id, newValue: JSON.stringify({ name: valid.value.name, adminLevel: valid.value.adminLevel, parentId: valid.value.parentId ?? null }) });
    return ok({ id: record.id });
  }
}

export class UpdatePlaceHandler {
  constructor(private readonly repo: IPlaceRepository, private readonly audit: IAuditLogger) {}

  async handle(ctx: AuthenticatedContext, id: string, input: UpdatePlaceInput): Promise<Result<void, DomainError>> {
    if (!canEdit(ctx)) return forbidden();
    const all = await loadAll(this.repo, ctx);
    if (!all.ok) return all;
    const current = all.value.stored.find((p) => p.id === id);
    if (!current) return err(DomainError.notFound("Place", id));
    const merged: PlaceRecord = { ...toRecord(current) };
    if (input.name !== undefined) merged.name = input.name;
    if (input.kind !== undefined) merged.kind = input.kind;
    if (input.adminLevel !== undefined) merged.adminLevel = input.adminLevel as PlaceRecord["adminLevel"];
    if (input.aliases !== undefined) merged.aliases = input.aliases;
    if (input.facility !== undefined) { if (input.facility) merged.facility = true; else delete merged.facility; }
    for (const key of ["parentId", "country", "latitude", "longitude", "code"] as const) {
      const v = input[key];
      if (v === undefined) continue;
      if (v === null) delete merged[key];
      else (merged as unknown as Record<string, unknown>)[key] = v;
    }
    if (merged.latitude !== undefined && input.kind === undefined) merged.kind = "POINT";
    if (input.placedBy !== undefined) merged.placedBy = input.placedBy;
    // With neither a pin nor a shape left, there is nothing for "how it was placed" to describe.
    if (merged.latitude === undefined && !merged.geometryKind) delete merged.placedBy;
    const valid = validatePlace(merged, all.value.stored.map(toRecord));
    if (!valid.ok) return valid;
    const saved = await this.repo.update({ ...valid.value, tenantId: current.tenantId, createdById: current.createdById, ...(current.archivedAt ? { archivedAt: current.archivedAt } : {}) });
    if (!saved.ok) return saved;
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "place.updated", entityType: "place", entityId: id, newValue: JSON.stringify(input) });
    return ok(undefined);
  }
}

/** Retire a place: it stops being offered; records that used it keep what was typed. Refused while live places sit inside it. */
export class ArchivePlaceHandler {
  constructor(private readonly repo: IPlaceRepository, private readonly audit: IAuditLogger, private readonly now: () => Date = () => new Date()) {}

  async handle(ctx: AuthenticatedContext, id: string, archive: boolean): Promise<Result<void, DomainError>> {
    if (!canEdit(ctx)) return forbidden();
    const all = await loadAll(this.repo, ctx, true);
    if (!all.ok) return all;
    const current = all.value.stored.find((p) => p.id === id);
    if (!current) return err(DomainError.notFound("Place", id));
    if (archive) {
      const live = new PlaceRegistry(all.value.stored.map(toRecord));
      const inside = live.childrenOf(id).length;
      if (inside > 0) return err(DomainError.validation(`${current.name} still has ${inside} ${inside === 1 ? "place" : "places"} inside it; retire those first`));
    } else if (current.parentId) {
      const parent = all.value.stored.find((p) => p.id === current.parentId);
      if (!parent || parent.archived || parent.archivedAt) return err(DomainError.validation(`Bring back ${parent?.name ?? "its parent place"} first`));
    }
    const { archivedAt: _was, ...kept } = current;
    const saved = await this.repo.update({ ...kept, archived: archive, ...(archive ? { archivedAt: this.now() } : {}) });
    if (!saved.ok) return saved;
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: archive ? "place.archived" : "place.restored", entityType: "place", entityId: id });
    return ok(undefined);
  }
}

export interface PlaceImportPreview {
  /** What would be added, parents first. */
  create: Array<{ name: string; level: number; path: string }>;
  skipped: Array<{ row: number; name: string }>;
  problems: Array<{ row: number; message: string }>;
  applied: boolean;
}

/** Any bad row blocks the whole sheet and names its row; `apply: false` previews and saves nothing. */
export class ImportPlacesHandler {
  constructor(private readonly ids: IIdGenerator, private readonly repo: IPlaceRepository, private readonly audit: IAuditLogger) {}

  async handle(ctx: AuthenticatedContext, input: ImportPlacesInput): Promise<Result<PlaceImportPreview, DomainError>> {
    if (!canEdit(ctx)) return forbidden();
    const parsed = parsePlaceSheet(input.text);
    if (parsed.problems.length) return ok({ create: [], skipped: [], problems: parsed.problems, applied: false });
    const all = await loadAll(this.repo, ctx);
    if (!all.ok) return all;
    const plan = planPlaceImport(parsed.rows, all.value.registry, () => this.ids.generate());
    const after = new PlaceRegistry([...all.value.stored.map(toRecord), ...plan.create]);
    const preview: PlaceImportPreview = {
      create: plan.create.map((p) => ({ name: p.name, level: p.adminLevel, path: after.pathLabel(p.id) })),
      skipped: plan.skipped, problems: plan.problems, applied: false,
    };
    if (!input.apply || plan.problems.length || plan.create.length === 0) return ok(preview);
    const saved = await this.repo.createMany(plan.create.map((p) => ({ ...p, tenantId: ctx.tenant.tenantId, createdById: ctx.tenant.userId })));
    if (!saved.ok) return saved;
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "place.imported", entityType: "place", entityId: "import", newValue: JSON.stringify({ created: plan.create.length, skipped: plan.skipped.length }) });
    return ok({ ...preview, applied: true });
  }
}

export interface SeedPlacesInput {
  country: { name: string };
  units: SeedUnit[];
  apply: boolean;
}

export interface SeedPlacesPreview {
  /** How many places would be (or were) created, by level (0 = the country itself). */
  createdByLevel: Record<number, number>;
  skipped: number;
  underCountry: number;
  problems: string[];
  applied: boolean;
}

/** A country's places from its built-in boundaries. `apply: false` only counts; a repeat creates nothing; a bad unit blocks the lot. */
export class SeedPlacesFromBoundariesHandler {
  constructor(private readonly ids: IIdGenerator, private readonly repo: IPlaceRepository, private readonly audit: IAuditLogger) {}

  async handle(ctx: AuthenticatedContext, input: SeedPlacesInput): Promise<Result<SeedPlacesPreview, DomainError>> {
    if (!canEdit(ctx)) return forbidden();
    const all = await loadAll(this.repo, ctx);
    if (!all.ok) return all;
    const plan = planBoundarySeed(input.country, input.units, all.value.registry, () => this.ids.generate());
    const createdByLevel: Record<number, number> = {};
    for (const p of plan.create) createdByLevel[p.adminLevel] = (createdByLevel[p.adminLevel] ?? 0) + 1;
    const preview: SeedPlacesPreview = { createdByLevel, skipped: plan.skipped, underCountry: plan.underCountry, problems: plan.problems, applied: false };
    if (!input.apply || plan.problems.length || plan.create.length === 0) return ok(preview);
    const saved = await this.repo.createMany(plan.create.map((p) => ({ ...p, tenantId: ctx.tenant.tenantId, createdById: ctx.tenant.userId })));
    if (!saved.ok) return saved;
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "place.seeded", entityType: "place", entityId: "seed", newValue: JSON.stringify({ country: input.country.name, created: plan.create.length, skipped: plan.skipped }) });
    return ok({ ...preview, applied: true });
  }
}

export interface ResolvedText {
  text: string;
  status: PlaceResolution["status"];
  place?: { id: string; name: string; path: string };
  candidates?: Array<{ id: string; name: string; path: string }>;
}

/** What each typed location means in the organisation's list. Suggests; never changes a record. */
export class ResolvePlacesHandler {
  constructor(private readonly repo: IPlaceRepository) {}

  async handle(ctx: AuthenticatedContext, input: ResolvePlacesInput): Promise<Result<ResolvedText[], DomainError>> {
    if (!canView(ctx)) return err(DomainError.forbidden("You cannot see places"));
    const all = await loadAll(this.repo, ctx);
    if (!all.ok) return all;
    const { registry } = all.value;
    const brief = (p: PlaceRecord) => ({ id: p.id, name: p.name, path: registry.pathLabel(p.id) });
    return ok(input.texts.map((text) => {
      const r = resolvePlace(text, registry, { ...(input.withinId ? { withinId: input.withinId } : {}), ...(input.country ? { country: input.country } : {}) });
      return { text, status: r.status, ...(r.status === "RESOLVED" ? { place: brief(r.place) } : {}), ...(r.status === "AMBIGUOUS" ? { candidates: r.candidates.map(brief) } : {}) };
    }));
  }
}

export interface UnconfirmedLocation {
  text: string;
  count: number;
  sources: string[];
  status: "UNRESOLVED" | "AMBIGUOUS";
  candidates?: Array<{ id: string; name: string; path: string }>;
}

/**
 * "Places to confirm": the location words people have typed that no place in the list answers to (or answers to twice).
 * Most-used first, so a few additions clear most of the queue. Read-only.
 */
export class ListUnconfirmedLocationsHandler {
  constructor(private readonly repo: IPlaceRepository, private readonly usage: IPlaceUsageReader) {}

  async handle(ctx: AuthenticatedContext): Promise<Result<{ items: UnconfirmedLocation[]; confirmed: number }, DomainError>> {
    if (!canView(ctx)) return err(DomainError.forbidden("You cannot see places"));
    const all = await loadAll(this.repo, ctx);
    if (!all.ok) return all;
    const used = await this.usage.distinctLocations(ctx.tenant.tenantId);
    if (!used.ok) return used;
    const { registry } = all.value;
    const items: UnconfirmedLocation[] = [];
    let confirmed = 0;
    for (const u of used.value) {
      const r = resolvePlace(u.text, registry);
      if (r.status === "RESOLVED") { confirmed += 1; continue; }
      items.push({
        text: u.text, count: u.count, sources: u.sources, status: r.status,
        ...(r.status === "AMBIGUOUS" ? { candidates: r.candidates.map((p) => ({ id: p.id, name: p.name, path: registry.pathLabel(p.id) })) } : {}),
      });
    }
    items.sort((a, b) => b.count - a.count || a.text.localeCompare(b.text));
    return ok({ items, confirmed });
  }
}
