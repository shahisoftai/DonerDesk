import { DomainError, PlaceRegistry, binPoints, err, ok, resolvePlace, validBBox, type BinnedPoints, type BinPoint, type Result } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IPlaceRepository } from "../../ports/places.js";
import type { IPlannedActivityRepository } from "../../ports/workplan.js";
import { canView, toRecord } from "./place-support.js";

/** How bad a plan status reads on a map (higher = worse). "Late" needs the delivery facts; a planned or started item counts as open. */
const STATUS_RANK: Readonly<Record<string, number>> = { CANCELLED: 0, DONE: 1 };

/**
 * A project's planned work as map points, grouped into grid cells when there are many (Phase 49.4; rule `binPoints`). A point is a planned
 * activity's own pin, else the pin of the place its typed location resolves to without doubt; anything else is counted as `unplaced`, never
 * put on the map at a guess. Cells carry counts only: names are sent only once the view is close.
 */
export class GetProjectMapPointsHandler {
  constructor(private readonly plan: IPlannedActivityRepository, private readonly places: IPlaceRepository) {}

  async handle(ctx: AuthenticatedContext, projectId: string, view: { bbox: readonly number[]; zoom: number }): Promise<Result<BinnedPoints & { unplaced: number }, DomainError>> {
    if (!canView(ctx)) return err(DomainError.forbidden("You cannot see this project"));
    if (!validBBox(view.bbox)) return err(DomainError.validation("The map view is not a valid box (west, south, east, north)"));
    const [items, stored] = await Promise.all([this.plan.findByProject(projectId, ctx.tenant.tenantId), this.places.list(ctx.tenant.tenantId)]);
    if (!items.ok) return items;
    if (!stored.ok) return stored;
    const registry = new PlaceRegistry(stored.value.filter((p) => !p.archived && p.archivedAt === undefined).map(toRecord));
    const points: BinPoint[] = [];
    let unplaced = 0;
    for (const item of items.value) {
      const s = item.snapshot();
      const rank = STATUS_RANK[s.status] ?? 2;
      if (s.latitude !== undefined && s.longitude !== undefined) { points.push({ lng: s.longitude, lat: s.latitude, rank }); continue; }
      const r = s.location ? resolvePlace(s.location, registry) : null;
      if (r?.status === "RESOLVED" && r.place.latitude !== undefined && r.place.longitude !== undefined) points.push({ lng: r.place.longitude, lat: r.place.latitude, rank });
      else unplaced++;
    }
    return ok({ ...binPoints(points, view.bbox as readonly [number, number, number, number], view.zoom), unplaced });
  }
}
