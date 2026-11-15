import { PlaceTree, parseDisaggregationJson, resolvePlace, withPlaceIds, type AdminLevel, type PlaceRecord } from "@donordesk/domain";
import type { PrismaClient } from "@prisma/client";

/**
 * Phase 56 backfill: links what projects already hold to the place tree, once. Idempotent (a second run changes nothing) and conservative:
 * only links the records state (a completed activity copies its planned activity's places; a typed word is linked only when exactly one place
 * answers to it inside the project's areas or the organisation); uncertain words stay in "To confirm". Nothing typed is rewritten.
 */
export interface BackfillReport {
  tenantId: string;
  projects: number;
  areasAdded: number;
  activitiesInherited: number;
  activitiesLinked: number;
  evidenceInherited: number;
  evidenceLinked: number;
  beneficiariesLinked: number;
  valueEntriesLinked: number;
  leftToConfirm: number;
}

const toRecord = (r: { id: string; name: string; kind: string; adminLevel: number; parentId: string | null; country: string | null; latitude: number | null; longitude: number | null; aliases: string[]; code: string | null; facility: boolean; mergedIntoId: string | null; archivedAt: Date | null }): PlaceRecord => ({
  id: r.id, name: r.name, kind: r.kind === "POINT" ? "POINT" : "AREA", adminLevel: r.adminLevel as AdminLevel, ...(r.parentId ? { parentId: r.parentId } : {}),
  ...(r.country ? { country: r.country } : {}), ...(r.latitude !== null && r.longitude !== null ? { latitude: r.latitude, longitude: r.longitude } : {}),
  aliases: r.aliases, ...(r.code ? { code: r.code } : {}), ...(r.facility ? { facility: true } : {}), ...(r.mergedIntoId ? { mergedIntoId: r.mergedIntoId } : {}), archived: r.archivedAt !== null,
});

/** The areas a project's places sit in: the deepest level (district, then province) at which every place below it has an ancestor; none = no footprint. */
export function footprintFromPlaces(tree: PlaceTree, placeIds: readonly string[]): string[] {
  for (const level of [2, 1] as const) {
    const below = placeIds.filter((id) => (tree.get(id)?.adminLevel ?? -1) >= level);
    if (below.length === 0) continue;
    const areas = below.map((id) => tree.chain(id).find((p) => p.adminLevel === level)?.id);
    if (areas.every((a): a is string => !!a)) return [...new Set(areas)];
  }
  return [];
}

export async function backfillTenant(prisma: PrismaClient, tenantId: string, options: { apply: boolean; actorId: string; now: Date }): Promise<BackfillReport> {
  const t = tenantId;
  const rows = await prisma.place.findMany({ where: { tenantId: t } });
  const tree = new PlaceTree(rows.map(toRecord));
  const report: BackfillReport = { tenantId: t, projects: 0, areasAdded: 0, activitiesInherited: 0, activitiesLinked: 0, evidenceInherited: 0, evidenceLinked: 0, beneficiariesLinked: 0, valueEntriesLinked: 0, leftToConfirm: 0 };
  const projects = await prisma.project.findMany({ where: { tenantId: t }, select: { id: true } });
  const write = async (fn: () => Promise<unknown>) => { if (options.apply) await fn(); };
  const resolveIn = (text: string | null | undefined, areaIds: readonly string[]): string | undefined => {
    if (!text?.trim()) return undefined;
    const all = resolvePlace(text, tree.registry);
    if (all.status === "RESOLVED") return all.place.id;
    if (all.status === "UNRESOLVED") { report.leftToConfirm += 1; return undefined; }
    for (const a of areaIds) { const r = resolvePlace(text, tree.registry, { withinId: a }); if (r.status === "RESOLVED") return r.place.id; }
    report.leftToConfirm += 1;
    return undefined;
  };
  for (const { id: projectId } of projects) {
    report.projects += 1;
    const base = { tenantId: t, projectId, createdById: options.actorId };
    const planned = await prisma.plannedActivityPlace.findMany({ where: { tenantId: t, projectId } });
    const plannedBy = new Map<string, string[]>();
    for (const l of planned) plannedBy.set(l.plannedActivityId, [...(plannedBy.get(l.plannedActivityId) ?? []), l.placeId]);
    const existingAreas = await prisma.projectArea.findMany({ where: { tenantId: t, projectId } });
    let areaIds = existingAreas.map((a) => a.placeId);

    // Footprint first (only when the project has none): from the places its plan already names.
    if (areaIds.length === 0) {
      const used = [...new Set(planned.map((l) => tree.current(l.placeId)).filter((x): x is string => !!x && tree.isLive(x)))];
      const proposed = footprintFromPlaces(tree, used);
      for (const placeId of proposed) await write(() => prisma.projectArea.create({ data: { id: `bf-${projectId}-${placeId}`, ...base, placeId, createdAt: options.now } }));
      report.areasAdded += proposed.length;
      areaIds = proposed;
    }

    const activities = await prisma.activityUpdate.findMany({ where: { tenantId: t, projectId }, select: { id: true, plannedActivityId: true, location: true } });
    const linkedActs = new Set((await prisma.activityUpdatePlace.findMany({ where: { tenantId: t, projectId }, select: { activityUpdateId: true } })).map((r) => r.activityUpdateId));
    const actPlaces = new Map<string, string[]>();
    for (const a of activities) {
      if (linkedActs.has(a.id)) continue;
      const inherited = a.plannedActivityId ? plannedBy.get(a.plannedActivityId) ?? [] : [];
      const ids = inherited.length ? inherited : [resolveIn(a.location, areaIds)].filter((x): x is string => !!x);
      if (!ids.length) continue;
      const source = inherited.length ? "INHERITED" : "CONFIRMED";
      actPlaces.set(a.id, ids);
      await write(() => prisma.activityUpdatePlace.createMany({ data: ids.map((placeId, i) => ({ id: `${a.id}:${placeId}`, ...base, activityUpdateId: a.id, placeId, source, createdAt: new Date(options.now.getTime() + i) })), skipDuplicates: true }));
      if (inherited.length) report.activitiesInherited += 1; else report.activitiesLinked += 1;
    }

    const files = await prisma.evidenceFile.findMany({ where: { tenantId: t, projectId }, select: { id: true, activityId: true, location: true } });
    const linkedFiles = new Set((await prisma.evidencePlace.findMany({ where: { tenantId: t, projectId }, select: { evidenceFileId: true } })).map((r) => r.evidenceFileId));
    for (const f of files) {
      if (linkedFiles.has(f.id)) continue;
      const fromAct = f.activityId ? actPlaces.get(f.activityId) ?? [] : [];
      const ids = fromAct.length ? fromAct.slice(0, 10) : [resolveIn(f.location, areaIds)].filter((x): x is string => !!x);
      if (!ids.length) continue;
      const source = fromAct.length ? "INHERITED" : "CONFIRMED";
      await write(() => prisma.evidencePlace.createMany({ data: ids.map((placeId, i) => ({ id: `${f.id}:${placeId}`, ...base, evidenceFileId: f.id, placeId, source, createdAt: new Date(options.now.getTime() + i) })), skipDuplicates: true }));
      if (fromAct.length) report.evidenceInherited += 1; else report.evidenceLinked += 1;
    }

    const people = await prisma.beneficiary.findMany({ where: { tenantId: t, projectId, location: { not: "" } }, select: { id: true, location: true } });
    const linkedPeople = new Set((await prisma.beneficiaryPlace.findMany({ where: { tenantId: t, projectId }, select: { beneficiaryId: true } })).map((r) => r.beneficiaryId));
    for (const p of people) {
      if (linkedPeople.has(p.id)) continue;
      const id = resolveIn(p.location, areaIds);
      if (!id) continue;
      await write(() => prisma.beneficiaryPlace.create({ data: { id: `${p.id}:${id}`, ...base, beneficiaryId: p.id, placeId: id, source: "CONFIRMED", createdAt: options.now } }));
      report.beneficiariesLinked += 1;
    }

    // By-place figures: an entry gets its place id only when one place inside the project's areas (or used by it) answers to its name.
    const candidates = [...new Set([...areaIds.flatMap((a) => [a, ...tree.descendants(a)]), ...planned.map((l) => l.placeId), ...[...actPlaces.values()].flat()])];
    const values = await prisma.indicatorUpdate.findMany({ where: { tenantId: t, disaggregationJson: { contains: "LOCATION" }, indicator: { projectId } }, select: { id: true, disaggregationJson: true } });
    for (const v of values) {
      const { entries, added } = withPlaceIds(parseDisaggregationJson(v.disaggregationJson), tree, candidates);
      if (!added) continue;
      await write(() => prisma.indicatorUpdate.update({ where: { id: v.id }, data: { disaggregationJson: JSON.stringify(entries) } }));
      report.valueEntriesLinked += added;
    }
  }
  return report;
}
