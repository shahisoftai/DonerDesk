import {
  DomainError, THREE_W_FIELD, checkMerge, err, isAdminLevel, ok, overlaps, suggestDuplicates, whoWhatWhere,
  type AdminLevel, type Result, type ThreeWLink, type ThreeWProject,
} from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger, IClock } from "../../ports/core.js";
import type { IPlaceRepository } from "../../ports/places.js";
import type { IPlaceMergeWriter, IProjectAreaRepository, IRecordPlaceRepository } from "../../ports/place-tree.js";
import type { VisibleProjects } from "../../services/visible-projects.js";
import { brief, can, loadTree, type PlaceBrief } from "./place-tree-support.js";

/**
 * The organisation's places (Phase 56). Where we work is derived from every project's footprint and linked work, never maintained by hand,
 * and shows only projects the viewer may see. Merging duplicates and the suggestions for it are for administrators (`org.manage`).
 */
export interface OrgPlacesDeps {
  visible: VisibleProjects;
  places: IPlaceRepository;
  areas: IProjectAreaRepository;
  links: IRecordPlaceRepository;
}

export interface WhereWeWorkView {
  level: AdminLevel;
  areas: Array<PlaceBrief & { projects: Array<{ id: string; title: string }>; plannedActivities: number; activities: number }>;
  overlaps: number;
  notPlacedAtLevel: number;
  /** Visible projects that have no area yet (their page asks for one). */
  projectsWithoutAreas: Array<{ id: string; title: string }>;
  canManage: boolean;
}

async function readWork(deps: OrgPlacesDeps, ctx: AuthenticatedContext) {
  const seen = await deps.visible.for(ctx);
  if (!seen.ok) return seen;
  const ids = new Set(seen.value.map((p) => p.id));
  const [areas, planned, done] = await Promise.all([
    deps.areas.listAll(ctx.tenant.tenantId),
    deps.links.listByProject("PLANNED_ACTIVITY", ctx.tenant.tenantId),
    deps.links.listByProject("ACTIVITY", ctx.tenant.tenantId),
  ]);
  if (!areas.ok) return areas;
  if (!planned.ok) return planned;
  if (!done.ok) return done;
  const projects: ThreeWProject[] = seen.value.map((p) => ({ id: p.id, name: p.title, sector: p.sector, areas: areas.value.filter((a) => a.projectId === p.id) }));
  const links: ThreeWLink[] = [
    ...planned.value.filter((l) => ids.has(l.projectId)).map((l) => ({ projectId: l.projectId, kind: "PLANNED_ACTIVITY" as const, placeId: l.placeId })),
    ...done.value.filter((l) => ids.has(l.projectId)).map((l) => ({ projectId: l.projectId, kind: "ACTIVITY" as const, placeId: l.placeId })),
  ];
  return ok({ projects, links, titles: new Map(seen.value.map((p) => [p.id, p.title])) });
}

export class GetWhereWeWorkHandler {
  constructor(private readonly deps: OrgPlacesDeps) {}

  async handle(ctx: AuthenticatedContext, input: { level?: number }): Promise<Result<WhereWeWorkView, DomainError>> {
    if (!can(ctx, "project.view")) return err(DomainError.forbidden("You cannot see places"));
    const level: AdminLevel = isAdminLevel(input.level) && input.level > 0 ? input.level : 1;
    const [tree, work] = await Promise.all([loadTree(this.deps.places, ctx), readWork(this.deps, ctx)]);
    if (!tree.ok) return tree;
    if (!work.ok) return work;
    const result = whoWhatWhere(work.value.projects, work.value.links, tree.value, level);
    const title = (id: string) => ({ id, title: work.value.titles.get(id) ?? "" });
    return ok({
      level,
      areas: result.areas.flatMap((a) => { const b = brief(tree.value, a.placeId); return b ? [{ ...b, projects: a.projectIds.map(title), plannedActivities: a.plannedActivities, activities: a.activities }] : []; }),
      overlaps: overlaps(result).length,
      notPlacedAtLevel: result.notPlacedAtLevel,
      projectsWithoutAreas: work.value.projects.filter((p) => p.areas.length === 0).map((p) => title(p.id)),
      canManage: can(ctx, "org.manage"),
    });
  }
}

export interface PlaceProfileView {
  place: PlaceBrief;
  chain: PlaceBrief[];
  children: PlaceBrief[];
  projects: Array<{ id: string; title: string; covers: boolean; plannedActivities: number; activities: number }>;
}

/** A place's page: where it sits, what is inside it, and the visible projects that cover it or recorded work in it (the place or below). */
export class GetPlaceProfileHandler {
  constructor(private readonly deps: OrgPlacesDeps) {}

  async handle(ctx: AuthenticatedContext, placeId: string): Promise<Result<PlaceProfileView, DomainError>> {
    if (!can(ctx, "project.view")) return err(DomainError.forbidden("You cannot see places"));
    const [tree, work] = await Promise.all([loadTree(this.deps.places, ctx), readWork(this.deps, ctx)]);
    if (!tree.ok) return tree;
    if (!work.ok) return work;
    const t = tree.value;
    const id = t.current(placeId);
    const place = id ? brief(t, id) : null;
    if (!id || !place) return err(DomainError.notFound("Place", placeId));
    const inside = new Set([id, ...t.descendants(id)]);
    const rows = new Map<string, { covers: boolean; plannedActivities: number; activities: number }>();
    const row = (pid: string) => { const r = rows.get(pid) ?? { covers: false, plannedActivities: 0, activities: 0 }; rows.set(pid, r); return r; };
    for (const p of work.value.projects) for (const a of p.areas) if (t.isInside(id, a.placeId) || inside.has(t.current(a.placeId) ?? "")) row(p.id).covers = true;
    for (const l of work.value.links) {
      const at = t.current(l.placeId);
      if (!at || !inside.has(at)) continue;
      row(l.projectId)[THREE_W_FIELD[l.kind]] += 1;
    }
    return ok({
      place,
      chain: t.chain(id).slice(1).map((p) => brief(t, p.id)!).filter(Boolean),
      children: t.children(id).map((c) => brief(t, c.id)!).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name)),
      projects: [...rows].map(([pid, r]) => ({ id: pid, title: work.value.titles.get(pid) ?? "", covers: r.covers, plannedActivities: r.plannedActivities, activities: r.activities }))
        .sort((a, b) => a.title.localeCompare(b.title)),
    });
  }
}

export class ListDuplicatePlacesHandler {
  constructor(private readonly places: IPlaceRepository) {}

  async handle(ctx: AuthenticatedContext): Promise<Result<{ pairs: Array<{ keep: PlaceBrief; merge: PlaceBrief; reason: "SAME_NAME" | "SAME_CODE" }> }, DomainError>> {
    if (!can(ctx, "org.manage")) return err(DomainError.forbidden("Only an administrator can merge places"));
    const tree = await loadTree(this.places, ctx);
    if (!tree.ok) return tree;
    return ok({ pairs: suggestDuplicates(tree.value).flatMap((s) => { const k = brief(tree.value, s.keepId); const m = brief(tree.value, s.mergeId); return k && m ? [{ keep: k, merge: m, reason: s.reason }] : []; }) });
  }
}

/** Merge one place into another: every link moves, children move under the survivor, the merged row is retired and points at it. One transaction. */
export class MergePlacesHandler {
  constructor(private readonly places: IPlaceRepository, private readonly writer: IPlaceMergeWriter, private readonly audit: IAuditLogger, private readonly clock: IClock) {}

  async handle(ctx: AuthenticatedContext, input: { keepId: string; mergeId: string }): Promise<Result<{ moved: number }, DomainError>> {
    if (!can(ctx, "org.manage")) return err(DomainError.forbidden("Only an administrator can merge places"));
    const tree = await loadTree(this.places, ctx);
    if (!tree.ok) return tree;
    const plan = checkMerge(input.keepId, input.mergeId, tree.value);
    if (!plan.ok) return plan;
    const done = await this.writer.merge(ctx.tenant.tenantId, { keepAfter: plan.value.keepAfter, mergedId: plan.value.merged.id, reparent: plan.value.reparent, now: this.clock.now() });
    if (!done.ok) return done;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "place.merged", entityType: "place", entityId: plan.value.keep.id,
      newValue: JSON.stringify({ merged: plan.value.merged.id, mergedName: plan.value.merged.name, moved: done.value.moved, reparented: plan.value.reparent.length }),
    });
    return ok(done.value);
  }
}
