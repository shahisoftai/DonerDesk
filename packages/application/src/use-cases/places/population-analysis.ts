import { DomainError, Permissions, err, ok, populationWithin, ringBox, type PopulationAnswer, type Result, type Role } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IPopulationGrids } from "../../ports/offline-maps.js";

export const MAX_RINGS = 50;

/**
 * How many people live within rings around chosen points (Phase 49.7), from the self-hosted population grid. Reads only public population
 * data: nothing about the project is used or stored, so it is not audited. Never sent to a report writer.
 */
export class AnalysePopulationHandler {
  constructor(private readonly grids: IPopulationGrids) {}

  async handle(ctx: AuthenticatedContext, rings: ReadonlyArray<{ lng: number; lat: number; km: number }>): Promise<Result<PopulationAnswer, DomainError>> {
    if (!Permissions.can(ctx.tenant.role as Role, "project.view")) return err(DomainError.forbidden("You cannot see this project"));
    if (rings.length === 0 || rings.length > MAX_RINGS) return err(DomainError.validation(`Choose between 1 and ${MAX_RINGS} points`));
    const boxes = rings.map((r) => ringBox({ lng: r.lng, lat: r.lat }, r.km));
    const box: [number, number, number, number] = [Math.min(...boxes.map((b) => b[0])), Math.min(...boxes.map((b) => b[1])), Math.max(...boxes.map((b) => b[2])), Math.max(...boxes.map((b) => b[3]))];
    const grid = await this.grids.covering(box);
    return ok(populationWithin(grid, rings.map((r) => ({ centre: { lng: r.lng, lat: r.lat }, km: r.km }))));
  }
}
