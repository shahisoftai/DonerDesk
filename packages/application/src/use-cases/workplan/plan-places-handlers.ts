import { DomainError, err, ok, checkPlanPlaces, type Result } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger, IClock } from "../../ports/core.js";
import type { IPlaceRepository } from "../../ports/places.js";
import type { IPlannedActivityPlaceRepository } from "../../ports/workplan.js";
import { PlanAccess } from "../../services/plan-access.js";
import { loadAll } from "../places/place-support.js";

export interface PlanPlaceDto {
  id: string;
  name: string;
  /** "Uganda › Northern › Gulu": where the place sits. */
  path: string;
  archived: boolean;
}

/** The places an activity names, in the order the person chose, with where each sits. Anyone who can see the plan. */
export class GetPlanPlacesHandler {
  constructor(private readonly access: PlanAccess, private readonly links: IPlannedActivityPlaceRepository, private readonly places: IPlaceRepository) {}

  async handle(ctx: AuthenticatedContext, itemId: string): Promise<Result<{ places: PlanPlaceDto[] }, DomainError>> {
    const item = await this.access.load(ctx, itemId, "VIEW");
    if (!item.ok) return item;
    const ids = await this.links.findPlaceIds(itemId, ctx.tenant.tenantId);
    if (!ids.ok) return ids;
    const all = await loadAll(this.places, ctx, true);
    if (!all.ok) return all;
    const byId = new Map(all.value.stored.map((p) => [p.id, p]));
    const rows = ids.value.flatMap((id) => {
      const p = byId.get(id);
      return p ? [{ id, name: p.name, path: all.value.registry.pathLabel(id), archived: p.archived }] : [];
    });
    return ok({ places: rows });
  }
}

/** Replaces the places an activity names. The lead or a manager may change it; each place must be in the list and not retired. The typed location is left as it is. */
export class SetPlanPlacesHandler {
  constructor(private readonly access: PlanAccess, private readonly links: IPlannedActivityPlaceRepository, private readonly places: IPlaceRepository, private readonly audit: IAuditLogger, private readonly clock: IClock) {}

  async handle(ctx: AuthenticatedContext, itemId: string, input: { placeIds: string[] }): Promise<Result<void, DomainError>> {
    const item = await this.access.load(ctx, itemId, "EDIT_NOTES");
    if (!item.ok) return item;
    const all = await this.places.list(ctx.tenant.tenantId, { includeArchived: true });
    if (!all.ok) return all;
    const checked = checkPlanPlaces(input.placeIds, all.value.map((p) => ({ id: p.id, name: p.name, archived: p.archived })));
    if (!checked.ok) return err(checked.error);
    const saved = await this.links.replace({ tenantId: ctx.tenant.tenantId.toString(), projectId: item.value.projectId, plannedActivityId: itemId, placeIds: checked.value, userId: ctx.tenant.userId, now: this.clock.now() });
    if (!saved.ok) return saved;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "workplan.places_set", entityType: "planned_activity", entityId: itemId,
      projectId: item.value.projectId, newValue: JSON.stringify(checked.value),
    });
    return ok(undefined);
  }
}
