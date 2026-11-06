import { DomainError, err, ok, type Result, type TenantId } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IDashboardRepository } from "../../ports/dashboards.js";
import type { IShareMapReader } from "../../services/share-link-extras.js";

/**
 * A results map on a shared dashboard asking for another level or period (Phase 41.8), so a link holder can open a country down to its districts and
 * move the time slider like a signed-in person. What keeps it safe:
 *  - the project is the one stored on the dashboard's own map widget, never one the request names;
 *  - only a "results by place" map widget of that dashboard can be asked, so a link cannot be used to read anything else;
 *  - the reader is the same read-only outside guest a share link already draws as, and finance is not part of place results.
 * Unknown, expired and revoked links are decided before this runs; an unknown widget or period is "not available", like everything else here.
 */
export interface PublicMapResultsInput { widgetId: string; level: number; periodId?: string | undefined }

export class PublicDashboardMapResultsHandler {
  constructor(private readonly repo: IDashboardRepository, private readonly maps: IShareMapReader) {}

  async handle(tenantId: TenantId, dashboardId: string, input: PublicMapResultsInput): Promise<Result<unknown, DomainError>> {
    if (!Number.isInteger(input.level) || input.level < 0 || input.level > 4) return err(DomainError.validation("That level is not one a map can show"));
    const found = await this.repo.findById(dashboardId, tenantId);
    if (!found.ok || !found.value) return err(DomainError.notFound("Dashboard", "unavailable"));
    const widget = found.value.widgets.find((w) => w.id === input.widgetId && w.kind === "MAP" && w.map?.view === "RESULTS");
    if (!widget) return err(DomainError.notFound("Map", "unavailable"));
    const guest: AuthenticatedContext = { tenant: { tenantId, userId: "share-link", role: "VIEWER", external: true } as never, requestId: "share-link" };
    const results = await this.maps.results(guest, widget.projectId, { level: input.level as 0 | 1 | 2 | 3 | 4, ...(input.periodId ? { periodId: input.periodId } : {}) });
    return results === undefined ? err(DomainError.notFound("Map", "unavailable")) : ok(results);
  }
}
