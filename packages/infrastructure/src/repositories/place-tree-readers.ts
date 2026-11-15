import { NO_DEPENDENTS, ok, parseDisaggregationJson, type AreaDependents, type IndicatorPlaceSetting, type PlaceRecord, type Result, type TenantId } from "@donordesk/domain";
import type { IAreaDependentsReader, IIndicatorPlaceStore, IndicatorPlaceRecord, IPlaceMergeWriter, IProjectTypedLocations, TypedLocation } from "@donordesk/application";
import type { PrismaClient } from "@prisma/client";

/** The typed location words of one project's records, and rewriting by-place indicator entries once a word is confirmed (Phase 56). */
export class PrismaProjectTypedLocations implements IProjectTypedLocations {
  constructor(private readonly prisma: PrismaClient) {}

  async typedIn(tenantId: TenantId, projectId: string): Promise<Result<TypedLocation[]>> {
    const t = tenantId.toString();
    const [plan, done, people, values] = await Promise.all([
      this.prisma.plannedActivity.findMany({ where: { tenantId: t, projectId, location: { not: null } }, select: { id: true, location: true } }),
      this.prisma.activityUpdate.findMany({ where: { tenantId: t, projectId, location: { not: null } }, select: { id: true, location: true } }),
      this.prisma.beneficiary.findMany({ where: { tenantId: t, projectId, location: { not: "" } }, select: { id: true, location: true } }),
      this.prisma.indicatorUpdate.findMany({ where: { tenantId: t, disaggregationJson: { contains: "LOCATION" }, indicator: { projectId } }, select: { id: true, disaggregationJson: true } }),
    ]);
    const out: TypedLocation[] = [];
    for (const r of plan) if (r.location?.trim()) out.push({ kind: "PLANNED_ACTIVITY", recordId: r.id, text: r.location });
    for (const r of done) if (r.location?.trim()) out.push({ kind: "ACTIVITY", recordId: r.id, text: r.location });
    for (const r of people) if (r.location.trim()) out.push({ kind: "BENEFICIARY", recordId: r.id, text: r.location });
    for (const r of values) for (const e of parseDisaggregationJson(r.disaggregationJson)) if (e.dimension === "LOCATION" && !e.placeId) out.push({ kind: "INDICATOR_VALUE", recordId: r.id, text: e.category });
    return ok(out);
  }

  async linkIndicatorEntries(tenantId: TenantId, projectId: string, word: string, placeId: string, normalize: (text: string) => string): Promise<Result<number>> {
    const rows = await this.prisma.indicatorUpdate.findMany({ where: { tenantId: tenantId.toString(), disaggregationJson: { contains: "LOCATION" }, indicator: { projectId } }, select: { id: true, disaggregationJson: true } });
    let changed = 0;
    for (const r of rows) {
      const entries = parseDisaggregationJson(r.disaggregationJson);
      let touched = false;
      const next = entries.map((e) => {
        if (e.dimension !== "LOCATION" || e.placeId || normalize(e.category) !== word) return e;
        touched = true; changed += 1;
        return { ...e, placeId };
      });
      if (touched) await this.prisma.indicatorUpdate.update({ where: { id: r.id }, data: { disaggregationJson: JSON.stringify(next) } });
    }
    return ok(changed);
  }
}

/** How many of a project's records sit in a set of places: stored links of every kind plus by-place indicator entries that carry an id. */
export class PrismaAreaDependentsReader implements IAreaDependentsReader {
  constructor(private readonly prisma: PrismaClient) {}

  async count(tenantId: TenantId, projectId: string, placeIds: ReadonlySet<string>): Promise<Result<AreaDependents>> {
    if (placeIds.size === 0) return ok({ ...NO_DEPENDENTS });
    const t = tenantId.toString();
    const ids = [...placeIds];
    const where = { tenantId: t, projectId, placeId: { in: ids } };
    const distinct = async (rows: Array<Record<string, unknown>>, key: string) => new Set(rows.map((r) => String(r[key]))).size;
    const [plan, done, files, people, values] = await Promise.all([
      this.prisma.plannedActivityPlace.findMany({ where, select: { plannedActivityId: true } }),
      this.prisma.activityUpdatePlace.findMany({ where, select: { activityUpdateId: true } }),
      this.prisma.evidencePlace.findMany({ where, select: { evidenceFileId: true } }),
      this.prisma.beneficiaryPlace.findMany({ where, select: { beneficiaryId: true } }),
      this.prisma.indicatorUpdate.findMany({ where: { tenantId: t, disaggregationJson: { contains: "placeId" }, indicator: { projectId } }, select: { disaggregationJson: true } }),
    ]);
    const valueCount = values.filter((v) => parseDisaggregationJson(v.disaggregationJson).some((e) => e.placeId && placeIds.has(e.placeId))).length;
    return ok({
      plannedActivities: await distinct(plan, "plannedActivityId"),
      activities: await distinct(done, "activityUpdateId"),
      evidence: await distinct(files, "evidenceFileId"),
      beneficiaries: await distinct(people, "beneficiaryId"),
      indicatorValues: valueCount,
    });
  }
}

/** A merge in one transaction: links of every kind, footprints, confirmed words and by-place indicator entries move to the survivor; children move under it. */
export class PrismaPlaceMergeWriter implements IPlaceMergeWriter {
  constructor(private readonly prisma: PrismaClient) {}

  async merge(tenantId: TenantId, input: { keepAfter: PlaceRecord; mergedId: string; reparent: readonly string[]; now: Date }): Promise<Result<{ moved: number }>> {
    const t = tenantId.toString();
    const keep = input.keepAfter;
    const from = input.mergedId;
    return this.prisma.$transaction(async (tx) => {
      let moved = 0;
      // A record linked to both places keeps one link: the merged one is dropped, the rest re-pointed.
      for (const [table, column] of [["plannedActivityPlace", "plannedActivityId"], ["activityUpdatePlace", "activityUpdateId"], ["evidencePlace", "evidenceFileId"], ["beneficiaryPlace", "beneficiaryId"]] as const) {
        const delegate = (tx as unknown as Record<string, { findMany(a: unknown): Promise<Array<Record<string, string>>>; deleteMany(a: unknown): Promise<{ count: number }>; updateMany(a: unknown): Promise<{ count: number }> }>)[table]!;
        const kept = new Set((await delegate.findMany({ where: { tenantId: t, placeId: keep.id }, select: { [column]: true } })).map((r) => r[column]));
        if (kept.size) await delegate.deleteMany({ where: { tenantId: t, placeId: from, [column]: { in: [...kept] } } });
        // The link id embeds the place; re-pointed rows keep their id (unique by record + place, not by id format).
        moved += (await delegate.updateMany({ where: { tenantId: t, placeId: from }, data: { placeId: keep.id } })).count;
      }
      const keptAreas = new Set((await tx.projectArea.findMany({ where: { tenantId: t, placeId: keep.id }, select: { projectId: true } })).map((r) => r.projectId));
      if (keptAreas.size) await tx.projectArea.deleteMany({ where: { tenantId: t, placeId: from, projectId: { in: [...keptAreas] } } });
      moved += (await tx.projectArea.updateMany({ where: { tenantId: t, placeId: from }, data: { placeId: keep.id } })).count;
      moved += (await tx.placeWordLink.updateMany({ where: { tenantId: t, placeId: from }, data: { placeId: keep.id } })).count;
      const values = await tx.indicatorUpdate.findMany({ where: { tenantId: t, disaggregationJson: { contains: from } }, select: { id: true, disaggregationJson: true } });
      for (const v of values) {
        const next = parseDisaggregationJson(v.disaggregationJson).map((e) => (e.placeId === from ? { ...e, placeId: keep.id } : e));
        await tx.indicatorUpdate.update({ where: { id: v.id }, data: { disaggregationJson: JSON.stringify(next) } });
        moved += 1;
      }
      if (input.reparent.length) await tx.place.updateMany({ where: { tenantId: t, id: { in: [...input.reparent] } }, data: { parentId: keep.id } });
      await tx.place.updateMany({
        where: { tenantId: t, id: keep.id },
        data: { aliases: keep.aliases, parentId: keep.parentId ?? null, code: keep.code ?? null, latitude: keep.latitude ?? null, longitude: keep.longitude ?? null },
      });
      await tx.place.updateMany({ where: { tenantId: t, id: from }, data: { mergedIntoId: keep.id, archivedAt: input.now } });
      return ok({ moved });
    });
  }
}

/** Where an indicator is measured (Phase 56). `recordByPlace` is kept in step so older readers (offline packs, the map) keep working. */
export class PrismaIndicatorPlaceStore implements IIndicatorPlaceStore {
  constructor(private readonly prisma: PrismaClient) {}

  async find(tenantId: string, indicatorId: string): Promise<Result<IndicatorPlaceRecord | null>> {
    const r = await this.prisma.indicator.findFirst({ where: { tenantId, id: indicatorId }, select: { id: true, projectId: true, name: true, formulaJson: true, placeScope: true, placeLevel: true, placeIdsJson: true, recordByPlace: true } });
    if (!r) return ok(null);
    let placeIds: string[] = [];
    try { const parsed: unknown = r.placeIdsJson ? JSON.parse(r.placeIdsJson) : []; if (Array.isArray(parsed)) placeIds = parsed.filter((x): x is string => typeof x === "string"); } catch { placeIds = []; }
    return ok({ id: r.id, projectId: r.projectId, title: r.name, calculated: !!r.formulaJson, placeScope: r.placeScope, placeLevel: r.placeLevel, placeIds, recordByPlace: r.recordByPlace });
  }

  async save(tenantId: string, indicatorId: string, setting: IndicatorPlaceSetting): Promise<Result<void>> {
    await this.prisma.indicator.updateMany({
      where: { tenantId, id: indicatorId },
      data: {
        placeScope: setting.scope,
        placeLevel: setting.scope === "LEVEL" ? setting.level ?? null : null,
        placeIdsJson: setting.scope === "CHOSEN" ? JSON.stringify(setting.placeIds ?? []) : null,
        recordByPlace: setting.scope !== "PROJECT",
      },
    });
    return ok(undefined);
  }

  async locationEntries(tenantId: string, indicatorId: string): Promise<Result<Array<{ category: string; placeId?: string }>>> {
    const rows = await this.prisma.indicatorUpdate.findMany({ where: { tenantId, indicatorId, disaggregationJson: { contains: "LOCATION" } }, select: { disaggregationJson: true } });
    const out: Array<{ category: string; placeId?: string }> = [];
    for (const r of rows) for (const e of parseDisaggregationJson(r.disaggregationJson)) if (e.dimension === "LOCATION") out.push({ category: e.category, ...(e.placeId ? { placeId: e.placeId } : {}) });
    return ok(out);
  }
}
