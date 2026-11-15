import {
  DomainError, checkPlaceSetting, entryRows, err, ok, placeOfEntry, placeSettingOf,
  type EntryRow, type IndicatorPlaceSetting, type Result,
} from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger } from "../../ports/core.js";
import type { IPlaceRepository } from "../../ports/places.js";
import type { IProjectRepository } from "../../ports/projects.js";
import type { IIndicatorPlaceStore, IProjectAreaRepository } from "../../ports/place-tree.js";
import type { VisibleProjects } from "../../services/visible-projects.js";
import { can, loadTree, visibleProject } from "./place-tree-support.js";

/**
 * Where an indicator is measured (Phase 56): for the whole project, at a level of the footprint, or at chosen places. The entry rows come
 * from the footprint and the setting; places that already hold a figure always stay listed. A calculated indicator is never typed by place.
 */
export interface IndicatorPlacesDeps {
  projects: IProjectRepository;
  visible: VisibleProjects;
  places: IPlaceRepository;
  areas: IProjectAreaRepository;
  store: IIndicatorPlaceStore;
  audit: IAuditLogger;
}

export interface IndicatorPlacesView {
  setting: IndicatorPlaceSetting;
  rows: EntryRow[];
  canEdit: boolean;
}

export class GetIndicatorPlacesHandler {
  constructor(private readonly deps: IndicatorPlacesDeps) {}

  async handle(ctx: AuthenticatedContext, indicatorId: string): Promise<Result<IndicatorPlacesView, DomainError>> {
    const ind = await this.deps.store.find(ctx.tenant.tenantId.toString(), indicatorId);
    if (!ind.ok) return ind;
    if (!ind.value) return err(DomainError.notFound("Indicator", indicatorId));
    const project = await visibleProject(this.deps.projects, this.deps.visible, ctx, ind.value.projectId);
    if (!project.ok) return project;
    const [tree, areas, entries] = await Promise.all([
      loadTree(this.deps.places, ctx), this.deps.areas.list(ctx.tenant.tenantId, ind.value.projectId), this.deps.store.locationEntries(ctx.tenant.tenantId.toString(), indicatorId),
    ]);
    if (!tree.ok) return tree;
    if (!areas.ok) return areas;
    if (!entries.ok) return entries;
    const setting = placeSettingOf(ind.value);
    const candidates = tree.value.live().map((p) => p.id);
    const withFigures = entries.value.map((e) => placeOfEntry({ dimension: "LOCATION", category: e.category, ...(e.placeId ? { placeId: e.placeId } : {}) }, tree.value, candidates)).filter((x): x is string => !!x);
    return ok({ setting, rows: entryRows(setting, areas.value, tree.value, withFigures), canEdit: can(ctx, "logframe.manage") && !ind.value.calculated });
  }
}

export class SetIndicatorPlacesHandler {
  constructor(private readonly deps: IndicatorPlacesDeps) {}

  async handle(ctx: AuthenticatedContext, indicatorId: string, input: IndicatorPlaceSetting): Promise<Result<IndicatorPlaceSetting, DomainError>> {
    if (!can(ctx, "logframe.manage")) return err(DomainError.forbidden("You cannot change how this indicator is recorded"));
    const ind = await this.deps.store.find(ctx.tenant.tenantId.toString(), indicatorId);
    if (!ind.ok) return ind;
    if (!ind.value) return err(DomainError.notFound("Indicator", indicatorId));
    const project = await visibleProject(this.deps.projects, this.deps.visible, ctx, ind.value.projectId);
    if (!project.ok) return project;
    if (ind.value.calculated && input.scope !== "PROJECT") return err(DomainError.validation("A calculated indicator is worked out from others; it is not typed by place"));
    const tree = await loadTree(this.deps.places, ctx);
    if (!tree.ok) return tree;
    const checked = checkPlaceSetting(input, tree.value);
    if (!checked.ok) return checked;
    const saved = await this.deps.store.save(ctx.tenant.tenantId.toString(), indicatorId, checked.value);
    if (!saved.ok) return saved;
    await this.deps.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "logframe.indicator.places_set", entityType: "indicator", entityId: indicatorId, projectId: ind.value.projectId, newValue: JSON.stringify(checked.value) });
    return ok(checked.value);
  }
}
