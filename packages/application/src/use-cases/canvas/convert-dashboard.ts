import { DomainError, canCreateCanvas, canSeeDashboard, legacyDashboardToCanvas, type Result } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger, IClock, IIdGenerator } from "../../ports/core.js";
import type { ICanvasRepository, StoredCanvas } from "../../ports/canvas.js";
import type { IDashboardRepository } from "../../ports/dashboards.js";
import { can, dtoOf, fail, ok, viewerOf, type CanvasDto } from "./canvas-shared.js";

export interface ConvertedDto { canvas: CanvasDto; /** True when this call made it; false when it already existed. */ created: boolean; /** Widgets that could not be read and were left out, with the reason. */ unreadable: Array<{ widgetId: string; reason: string }> }

export class ConvertDashboardHandler {
  constructor(private readonly dashboards: IDashboardRepository, private readonly repo: ICanvasRepository, private readonly ids: IIdGenerator, private readonly audit: IAuditLogger, private readonly clock: IClock) {}

  /** Idempotent: a dashboard becomes one canvas, once. The dashboard itself is not changed or removed. */
  async handle(ctx: AuthenticatedContext, dashboardId: string): Promise<Result<ConvertedDto, DomainError>> {
    if (!can(ctx, "project.view")) return fail(DomainError.forbidden("You cannot see dashboards"));
    const d = await this.dashboards.findById(dashboardId, ctx.tenant.tenantId);
    if (!d.ok) return d;
    if (!d.value || !canSeeDashboard(d.value, viewerOf(ctx))) return fail(DomainError.notFound("Dashboard", dashboardId));
    const existing = await this.repo.findBySource(ctx.tenant.tenantId, "DASHBOARD", dashboardId);
    if (!existing.ok) return existing;
    if (existing.value) return ok({ canvas: dtoOf(existing.value, ctx), created: false, unreadable: [] });
    if (!canCreateCanvas(d.value.scope, viewerOf(ctx))) return fail(DomainError.forbidden("Someone who manages shared work needs to open this shared dashboard first"));
    const id = this.ids.generate();
    const { canvas, unreadable } = legacyDashboardToCanvas({ id, title: d.value.name, scope: d.value.scope, revision: 1, widgets: d.value.widgets });
    const now = this.clock.now();
    const stored: StoredCanvas = { id, tenantId: ctx.tenant.tenantId, scope: d.value.scope, mode: "LIVE", ...(d.value.projectId ? { projectId: d.value.projectId } : {}), ownerId: d.value.ownerId, title: d.value.name, canvas, sourceKind: "DASHBOARD", sourceId: dashboardId, createdAt: now, updatedAt: now };
    const made = await this.repo.create(stored);
    if (!made.ok) return made;
    if (!made.value) {
      // Someone converted it at the same moment: theirs is the canvas.
      const theirs = await this.repo.findBySource(ctx.tenant.tenantId, "DASHBOARD", dashboardId);
      if (!theirs.ok) return theirs;
      if (theirs.value) return ok({ canvas: dtoOf(theirs.value, ctx), created: false, unreadable: [] });
      return fail(DomainError.conflict("This dashboard could not be opened as a canvas. Try again."));
    }
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "canvas.converted", entityType: "canvas", entityId: id, newValue: JSON.stringify({ from: "DASHBOARD", sourceId: dashboardId, unreadable: unreadable.length }) });
    return ok({ canvas: dtoOf(stored, ctx), created: true, unreadable });
  }
}
