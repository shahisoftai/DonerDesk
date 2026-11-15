import {
  DomainError, err, insideFootprint, normalizeFacilityTypeKey, ok, validatePlace,
  type AdminLevel, type PlaceRecord, type Result, type SeedUnit,
} from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger, IClock, IIdGenerator } from "../../ports/core.js";
import type { IPlaceRepository } from "../../ports/places.js";
import type { IProjectRepository } from "../../ports/projects.js";
import type { IProjectAreaRepository } from "../../ports/place-tree.js";
import type { VisibleProjects } from "../../services/visible-projects.js";
import { materialiseUnits } from "./project-areas.js";
import { brief, can, loadTree, visibleProject, type PlaceBrief } from "./place-tree-support.js";
import { toRecord } from "./place-support.js";

/**
 * Adding a place where you are (Phase 56): from any picker inside a project, a person adds a village, a site or a facility without leaving
 * the form. It always sits under a parent (chosen, or an area picked from the built-in boundaries, created on use), never floating. People
 * who may edit the project may add anywhere (outside the footprint is reported); an outside partner adds sites only inside the project's areas.
 */
export interface InlinePlaceDeps {
  projects: IProjectRepository;
  visible: VisibleProjects;
  places: IPlaceRepository;
  areas: IProjectAreaRepository;
  audit: IAuditLogger;
  clock: IClock;
  ids: IIdGenerator;
}

export interface AddPlaceInlineInput {
  name: string;
  /** The place it sits in: an id from the list, or a boundary unit (with the units above it). */
  parent: { placeId: string } | { country: { name: string }; units: SeedUnit[]; targetRef: string };
  /** One level below the parent unless given; a site (4) when the parent is a district or finer. */
  adminLevel?: number;
  facility?: boolean;
  facilityType?: string;
  latitude?: number;
  longitude?: number;
  placedBy?: "TYPED" | "MAP_PIN" | "GPS";
}

/** Who may add inline: anyone who records work in the project (field officers included); partners inside the footprint only. */
const MAY_ADD = ["project.edit", "activity.create", "indicator.update", "evidence.upload"] as const;

export class AddPlaceInlineHandler {
  constructor(private readonly deps: InlinePlaceDeps) {}

  async handle(ctx: AuthenticatedContext, projectId: string, input: AddPlaceInlineInput): Promise<Result<{ place: PlaceBrief; outside: boolean; existed: boolean }, DomainError>> {
    if (!MAY_ADD.some((p) => can(ctx, p))) return err(DomainError.forbidden("You cannot add places"));
    const project = await visibleProject(this.deps.projects, this.deps.visible, ctx, projectId);
    if (!project.ok) return project;
    let tree = await loadTree(this.deps.places, ctx);
    if (!tree.ok) return tree;
    let parentId: string;
    if ("placeId" in input.parent) parentId = tree.value.current(input.parent.placeId) ?? input.parent.placeId;
    else {
      if (!can(ctx, "project.edit") && ctx.tenant.external) return err(DomainError.forbidden("Choose an area of this project"));
      const made = await materialiseUnits(this.deps, ctx, tree.value, input.parent);
      if (!made.ok) return made;
      parentId = made.value;
      tree = await loadTree(this.deps.places, ctx);
      if (!tree.ok) return tree;
    }
    const parent = tree.value.get(parentId);
    if (!parent || parent.archived) return err(DomainError.validation("Choose the place it is in", { field: "parent" }));
    const areas = await this.deps.areas.list(ctx.tenant.tenantId, projectId);
    if (!areas.ok) return areas;
    const verdict = insideFootprint(parent.id, areas.value, tree.value);
    if (ctx.tenant.external && verdict.status !== "INSIDE") return err(DomainError.validation("Add places inside this project's areas"));
    const level = (input.adminLevel ?? (parent.adminLevel >= 2 ? 4 : parent.adminLevel + 1)) as AdminLevel;
    if (level <= parent.adminLevel || level > 4) return err(DomainError.validation(`A place inside ${parent.name} sits below it`, { field: "adminLevel" }));
    // Same name already under that parent: that is the place, not a new one (a repeat from an offline queue lands here too).
    const same = tree.value.children(parent.id).find((c) => c.name.trim().toLowerCase() === input.name.trim().toLowerCase() || c.aliases.some((a) => a.trim().toLowerCase() === input.name.trim().toLowerCase()));
    if (same) return ok({ place: brief(tree.value, same.id)!, outside: verdict.status === "OUTSIDE", existed: true });
    const pinned = input.latitude !== undefined && input.longitude !== undefined;
    const record: PlaceRecord = {
      id: this.deps.ids.generate(), name: input.name, kind: pinned || level === 4 ? "POINT" : "AREA", adminLevel: level, parentId: parent.id,
      ...(parent.country ? { country: parent.country } : {}), ...(pinned ? { latitude: input.latitude!, longitude: input.longitude! } : {}),
      aliases: [], ...(input.facility ? { facility: true } : {}), ...(input.facility && input.facilityType ? { facilityType: normalizeFacilityTypeKey(input.facilityType) } : {}),
      ...(pinned ? { placedBy: input.placedBy ?? "MAP_PIN" } : { placedBy: "TYPED" }), archived: false,
    };
    const all = await this.deps.places.list(ctx.tenant.tenantId);
    if (!all.ok) return all;
    const valid = validatePlace(record, all.value.map(toRecord));
    if (!valid.ok) return valid;
    const saved = await this.deps.places.createMany([{ ...valid.value, tenantId: ctx.tenant.tenantId, createdById: ctx.tenant.userId }]);
    if (!saved.ok) return saved;
    await this.deps.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "place.added_inline", entityType: "place", entityId: record.id, projectId, newValue: JSON.stringify({ name: valid.value.name, parentId: parent.id, adminLevel: level }) });
    const after = await loadTree(this.deps.places, ctx);
    if (!after.ok) return after;
    return ok({ place: brief(after.value, record.id)!, outside: verdict.status === "OUTSIDE", existed: false });
  }
}
