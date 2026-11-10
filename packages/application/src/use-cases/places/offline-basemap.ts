import { DomainError, Permissions, err, ok, validBBox, type Result, type Role } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IOfflineBasemapBuilder, OfflineBasemapFile } from "../../ports/offline-maps.js";

/** The largest area a phone may take offline (square degrees: about the size of Nigeria). Bigger is refused with the reason. */
export const OFFLINE_MAX_AREA = 120;
/** Detail falls with area so a download stays phone-sized: streets for a district, roads and towns for a country. */
export const offlineMaxZoom = (area: number): number => (area <= 4 ? 13 : area <= 30 ? 11 : 9);

const RECORDERS = ["indicator.update", "activity.create", "evidence.upload", "workplan.update-own"] as const;

/**
 * A basemap for a project's area that a phone keeps for working without a signal (Phase 49.4). Only for people who may record (the same
 * rule as the offline pack). Holds no tenant data: it is a piece of the public street map, cut to the box the phone asks for.
 */
export class GetOfflineBasemapHandler {
  constructor(private readonly builder: IOfflineBasemapBuilder) {}

  async handle(ctx: AuthenticatedContext, bbox: readonly number[]): Promise<Result<OfflineBasemapFile, DomainError>> {
    if (!RECORDERS.some((p) => Permissions.can(ctx.tenant.role as Role, p))) return err(DomainError.forbidden("You cannot record on this project"));
    if (!validBBox(bbox)) return err(DomainError.validation("The area is not a valid box (west, south, east, north)"));
    const area = (bbox[2]! - bbox[0]!) * (bbox[3]! - bbox[1]!);
    if (area > OFFLINE_MAX_AREA) return err(DomainError.validation("That area is too large to keep on a phone; zoom in to the part you work in"));
    const file = await this.builder.build(bbox as readonly [number, number, number, number], offlineMaxZoom(area));
    return file ? ok(file) : err(DomainError.conflict("A map for offline use cannot be made for this area yet"));
  }
}
