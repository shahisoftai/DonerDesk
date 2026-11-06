import { DomainError, TenantId, err, ok, type Result } from "@donordesk/domain";
import type { IPlaceRepository, IPlaceUsageReader, LocationUsage, StoredPlace } from "@donordesk/application";
import type { PrismaClient } from "@prisma/client";

type Row = NonNullable<Awaited<ReturnType<PrismaClient["place"]["findFirst"]>>>;

function placeFrom(row: Row): StoredPlace {
  return {
    id: row.id, tenantId: TenantId.create(row.tenantId), name: row.name, kind: row.kind === "POINT" ? "POINT" : "AREA",
    adminLevel: row.adminLevel as StoredPlace["adminLevel"], ...(row.parentId ? { parentId: row.parentId } : {}),
    ...(row.country ? { country: row.country } : {}), ...(row.latitude !== null && row.longitude !== null ? { latitude: row.latitude, longitude: row.longitude } : {}),
    aliases: row.aliases, ...(row.code ? { code: row.code } : {}), ...(row.facility ? { facility: true } : {}),
    ...(row.geometryKind === "POLYGON" || row.geometryKind === "LINE" ? { geometryKind: row.geometryKind } : {}),
    ...(row.geometryKey ? { geometryKey: row.geometryKey } : {}), ...(row.geometryBytes !== null ? { geometryBytes: row.geometryBytes } : {}),
    ...(row.placedBy ? { placedBy: row.placedBy as StoredPlace["placedBy"] & string } : {}), archived: row.archivedAt !== null,
    createdById: row.createdById, ...(row.archivedAt ? { archivedAt: row.archivedAt } : {}),
  };
}

export class PrismaPlaceRepository implements IPlaceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async list(tenantId: TenantId, options: { includeArchived?: boolean } = {}): Promise<Result<StoredPlace[]>> {
    const rows = await this.prisma.place.findMany({
      where: { tenantId: tenantId.toString(), ...(options.includeArchived ? {} : { archivedAt: null }) },
      orderBy: [{ adminLevel: "asc" }, { name: "asc" }],
    });
    return ok(rows.map(placeFrom));
  }

  async findById(id: string, tenantId: TenantId): Promise<Result<StoredPlace | null>> {
    const row = await this.prisma.place.findFirst({ where: { id, tenantId: tenantId.toString() } });
    return ok(row ? placeFrom(row) : null);
  }

  async createMany(places: StoredPlace[]): Promise<Result<void>> {
    await this.prisma.place.createMany({
      data: places.map((p) => ({
        id: p.id, tenantId: p.tenantId.toString(), name: p.name, kind: p.kind, adminLevel: p.adminLevel, parentId: p.parentId ?? null,
        country: p.country ?? null, latitude: p.latitude ?? null, longitude: p.longitude ?? null, aliases: p.aliases, code: p.code ?? null, facility: p.facility ?? false, createdById: p.createdById,
        geometryKind: p.geometryKind ?? null, geometryKey: p.geometryKey ?? null, geometryBytes: p.geometryBytes ?? null, placedBy: p.placedBy ?? null,
      })),
    });
    return ok(undefined);
  }

  /** Writes every mutable field; `?? null` so a cleared field is cleared (Prisma ignores `undefined`). */
  async update(place: StoredPlace): Promise<Result<void>> {
    const r = await this.prisma.place.updateMany({
      where: { id: place.id, tenantId: place.tenantId.toString() },
      data: {
        name: place.name, kind: place.kind, adminLevel: place.adminLevel, parentId: place.parentId ?? null, country: place.country ?? null,
        latitude: place.latitude ?? null, longitude: place.longitude ?? null, aliases: place.aliases, code: place.code ?? null, facility: place.facility ?? false,
        geometryKind: place.geometryKind ?? null, geometryKey: place.geometryKey ?? null, geometryBytes: place.geometryBytes ?? null, placedBy: place.placedBy ?? null,
        archivedAt: place.archived ? place.archivedAt ?? new Date() : null,
      },
    });
    return r.count === 1 ? ok(undefined) : err(DomainError.notFound("Place", place.id));
  }
}

/** Reads the words people typed for a location from every record that carries one. Never writes. */
export class PrismaPlaceUsageReader implements IPlaceUsageReader {
  constructor(private readonly prisma: PrismaClient) {}

  async distinctLocations(tenantId: TenantId): Promise<Result<LocationUsage[]>> {
    const t = tenantId.toString();
    const tally = new Map<string, { text: string; sources: Set<LocationUsage["sources"][number]>; count: number }>();
    const add = (raw: string | null | undefined, source: LocationUsage["sources"][number], times = 1) => {
      const text = raw?.trim();
      if (!text) return;
      const key = text.toLowerCase();
      const at = tally.get(key) ?? { text, sources: new Set(), count: 0 };
      at.sources.add(source);
      at.count += times;
      tally.set(key, at);
    };
    // The database counts each distinct typed word once instead of sending every record; the four reads run together.
    const [plan, activity, beneficiary, values] = await Promise.all([
      this.prisma.plannedActivity.groupBy({ by: ["location"], where: { tenantId: t, location: { not: null } }, _count: { _all: true }, orderBy: { location: "asc" } }),
      this.prisma.activityUpdate.groupBy({ by: ["location"], where: { tenantId: t, location: { not: null } }, _count: { _all: true }, orderBy: { location: "asc" } }),
      this.prisma.beneficiary.groupBy({ by: ["location"], where: { tenantId: t, location: { not: "" } }, _count: { _all: true }, orderBy: { location: "asc" } }),
      // The breakdown is stored as JSON text, so only the rows that name the dimension are read and parsed.
      this.prisma.indicatorUpdate.findMany({ where: { tenantId: t, disaggregationJson: { contains: "LOCATION" } }, select: { disaggregationJson: true } }),
    ]);
    for (const r of plan) add(r.location, "PLAN", r._count._all);
    for (const r of activity) add(r.location, "ACTIVITY", r._count._all);
    for (const r of beneficiary) add(r.location, "BENEFICIARY", r._count._all);
    for (const r of values) {
      let entries: unknown;
      try { entries = JSON.parse(r.disaggregationJson); } catch { continue; }
      if (!Array.isArray(entries)) continue;
      for (const e of entries as Array<{ dimension?: string; category?: string }>) if (e.dimension === "LOCATION") add(e.category, "INDICATOR");
    }
    return ok([...tally.values()].map((v) => ({ text: v.text, sources: [...v.sources], count: v.count })));
  }
}
