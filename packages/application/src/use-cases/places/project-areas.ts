import {
  DomainError, NO_DEPENDENTS, areasInside, checkAddArea, checkCloseArea, checkReopenArea, checkUntickArea, err, ok, planBoundarySeed,
  type PlaceTree, type Result, type SeedUnit,
} from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger, IClock, IIdGenerator } from "../../ports/core.js";
import type { IPlaceRepository } from "../../ports/places.js";
import type { IProjectRepository } from "../../ports/projects.js";
import type { IAreaDependentsReader, IProjectAreaRepository, StoredProjectArea } from "../../ports/place-tree.js";
import type { VisibleProjects } from "../../services/visible-projects.js";
import { can, loadTree, visibleProject } from "./place-tree-support.js";

/**
 * A project's footprint (Phase 56): the areas it works in. Ticking adds an area (creating it from the built-in boundaries when the list does
 * not hold it yet, with the areas above it); unticking is refused while the project's records sit inside; closing stops new work and keeps
 * history. Changing it needs `project.edit`; every change is audited.
 */
export interface AreaDeps {
  projects: IProjectRepository;
  visible: VisibleProjects;
  places: IPlaceRepository;
  areas: IProjectAreaRepository;
  dependents: IAreaDependentsReader;
  audit: IAuditLogger;
  clock: IClock;
  ids: IIdGenerator;
}

export type TickAreaInput =
  /** An area already in the places list. */
  | { placeId: string }
  /** An area from the built-in boundaries: the unit and the units above it; `targetRef` names the one ticked. */
  | { country: { name: string }; units: SeedUnit[]; targetRef: string };

const forbidden = () => err(DomainError.forbidden("You cannot change where this project works"));

/** Creates the boundary units the list lacks (idempotent: a unit already listed is reused) and answers the id of the target unit. */
export async function materialiseUnits(deps: Pick<AreaDeps, "places" | "audit" | "ids">, ctx: AuthenticatedContext, tree: PlaceTree, input: { country: { name: string }; units: SeedUnit[]; targetRef: string }): Promise<Result<string, DomainError>> {
  const plan = planBoundarySeed(input.country, input.units, tree.registry, () => deps.ids.generate());
  if (plan.problems.length) return err(DomainError.validation(plan.problems[0]!));
  const target = plan.idByRef?.get(input.targetRef);
  if (!target) return err(DomainError.validation("That area could not be found in the boundaries"));
  if (plan.create.length) {
    const saved = await deps.places.createMany(plan.create.map((p) => ({ ...p, tenantId: ctx.tenant.tenantId, createdById: ctx.tenant.userId })));
    if (!saved.ok) return saved;
    await deps.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "place.seeded", entityType: "place", entityId: target, newValue: JSON.stringify({ country: input.country.name, created: plan.create.length }) });
  }
  return ok(target);
}

export class TickProjectAreaHandler {
  constructor(private readonly deps: AreaDeps) {}

  async handle(ctx: AuthenticatedContext, projectId: string, input: TickAreaInput): Promise<Result<{ placeId: string; replaced: string[] }, DomainError>> {
    if (!can(ctx, "project.edit")) return forbidden();
    const project = await visibleProject(this.deps.projects, this.deps.visible, ctx, projectId);
    if (!project.ok) return project;
    let tree = await loadTree(this.deps.places, ctx);
    if (!tree.ok) return tree;
    let placeId: string;
    if ("placeId" in input) placeId = input.placeId;
    else {
      const made = await materialiseUnits(this.deps, ctx, tree.value, input);
      if (!made.ok) return made;
      placeId = made.value;
      tree = await loadTree(this.deps.places, ctx);
      if (!tree.ok) return tree;
    }
    const current = tree.value.current(placeId) ?? placeId;
    const areas = await this.deps.areas.list(ctx.tenant.tenantId, projectId);
    if (!areas.ok) return areas;
    const checked = checkAddArea(current, areas.value, tree.value);
    if (!checked.ok) return checked;
    const replaced = areasInside(current, areas.value, tree.value).map((a) => a.placeId);
    const row: StoredProjectArea = {
      id: this.deps.ids.generate(), tenantId: ctx.tenant.tenantId.toString(), projectId, placeId: current, closedAt: null, closedReason: null,
      createdById: ctx.tenant.userId, createdAt: this.deps.clock.now(),
    };
    const saved = await this.deps.areas.add(row, replaced);
    if (!saved.ok) return saved;
    await this.deps.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "place.area_added", entityType: "project", entityId: projectId, projectId, newValue: JSON.stringify({ placeId: current, replaced }) });
    return ok({ placeId: current, replaced });
  }
}

/** Every place id an area covers: the area and every place inside it (merged ids are already followed by the tree). */
export const coveredBy = (tree: PlaceTree, areaId: string): Set<string> => new Set([areaId, ...tree.descendants(areaId)]);

export class UntickProjectAreaHandler {
  constructor(private readonly deps: AreaDeps) {}

  async handle(ctx: AuthenticatedContext, projectId: string, placeId: string): Promise<Result<void, DomainError>> {
    if (!can(ctx, "project.edit")) return forbidden();
    const project = await visibleProject(this.deps.projects, this.deps.visible, ctx, projectId);
    if (!project.ok) return project;
    const tree = await loadTree(this.deps.places, ctx);
    if (!tree.ok) return tree;
    const areas = await this.deps.areas.list(ctx.tenant.tenantId, projectId);
    if (!areas.ok) return areas;
    const area = areas.value.find((a) => a.placeId === placeId || tree.value.current(a.placeId) === placeId);
    if (!area) return err(DomainError.notFound("Project area", placeId));
    const counted = await this.deps.dependents.count(ctx.tenant.tenantId, projectId, coveredBy(tree.value, tree.value.current(area.placeId) ?? area.placeId));
    if (!counted.ok) return counted;
    const allowed = checkUntickArea(tree.value.get(area.placeId)?.name ?? "This area", counted.value ?? NO_DEPENDENTS);
    if (!allowed.ok) return allowed;
    const removed = await this.deps.areas.remove(ctx.tenant.tenantId, projectId, area.placeId);
    if (!removed.ok) return removed;
    await this.deps.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "place.area_removed", entityType: "project", entityId: projectId, projectId, newValue: JSON.stringify({ placeId: area.placeId }) });
    return ok(undefined);
  }
}

/** Close (with a reason) or reopen an area. Closing keeps every record and its roll-up; the picker stops offering the area for new work. */
export class SetProjectAreaOpenHandler {
  constructor(private readonly deps: AreaDeps) {}

  async handle(ctx: AuthenticatedContext, projectId: string, placeId: string, input: { open: boolean; reason?: string }): Promise<Result<void, DomainError>> {
    if (!can(ctx, "project.edit")) return forbidden();
    const project = await visibleProject(this.deps.projects, this.deps.visible, ctx, projectId);
    if (!project.ok) return project;
    const areas = await this.deps.areas.list(ctx.tenant.tenantId, projectId);
    if (!areas.ok) return areas;
    const area = areas.value.find((a) => a.placeId === placeId);
    if (!area) return err(DomainError.notFound("Project area", placeId));
    let next: StoredProjectArea;
    if (input.open) {
      const allowed = checkReopenArea(area);
      if (!allowed.ok) return allowed;
      next = { ...area, closedAt: null, closedReason: null };
    } else {
      const reason = checkCloseArea(area, input.reason ?? "");
      if (!reason.ok) return reason;
      next = { ...area, closedAt: this.deps.clock.now(), closedReason: reason.value };
    }
    const saved = await this.deps.areas.update(next);
    if (!saved.ok) return saved;
    await this.deps.audit.record({
      tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: input.open ? "place.area_reopened" : "place.area_closed", entityType: "project", entityId: projectId, projectId,
      newValue: JSON.stringify({ placeId, ...(input.open ? {} : { reason: next.closedReason }) }),
    });
    return ok(undefined);
  }
}
