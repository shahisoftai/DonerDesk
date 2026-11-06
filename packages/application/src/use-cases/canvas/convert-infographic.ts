import { DomainError, PORTFOLIO_PROJECT_ID, canCreateCanvas, legacyInfographicToCanvas, type InfographicConfig, type Result } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger, IClock, IIdGenerator } from "../../ports/core.js";
import type { ICanvasRepository, StoredCanvas } from "../../ports/canvas.js";
import type { IInfographicRepository } from "../../ports/infographics.js";
import type { VisibleProjects } from "../../services/visible-projects.js";
import { can, dtoOf, fail, ok, viewerOf } from "./canvas-shared.js";
import type { ConvertedDto } from "./convert-dashboard.js";

export class ConvertInfographicHandler {
  constructor(private readonly infographics: IInfographicRepository, private readonly repo: ICanvasRepository, private readonly visible: VisibleProjects, private readonly ids: IIdGenerator, private readonly audit: IAuditLogger, private readonly clock: IClock) {}

  /** Idempotent: a design becomes one canvas, once. The design, its approval and its published files are not changed or removed. */
  async handle(ctx: AuthenticatedContext, infographicId: string): Promise<Result<ConvertedDto, DomainError>> {
    if (!can(ctx, "project.view")) return fail(DomainError.forbidden("You cannot see infographics"));
    const found = await this.infographics.findById(infographicId, ctx.tenant.tenantId);
    if (!found.ok) return found;
    if (!found.value) return fail(DomainError.notFound("Infographic", infographicId));
    const portfolio = found.value.projectId === PORTFOLIO_PROJECT_ID;
    if (!portfolio) {
      const mine = await this.visible.for(ctx);
      if (!mine.ok) return mine;
      if (!mine.value.some((p) => p.id === found.value!.projectId)) return fail(DomainError.notFound("Infographic", infographicId));
    }
    const existing = await this.repo.findBySource(ctx.tenant.tenantId, "INFOGRAPHIC", infographicId);
    if (!existing.ok) return existing;
    if (existing.value) return ok({ canvas: dtoOf(existing.value, ctx), created: false, unreadable: [] });
    const scope = portfolio ? "PORTFOLIO" : "PROJECT";
    if (!canCreateCanvas(scope, viewerOf(ctx))) return fail(DomainError.forbidden("Someone who manages shared work needs to open this design first"));
    let config: InfographicConfig;
    try { config = JSON.parse(found.value.configJson) as InfographicConfig; } catch { return fail(DomainError.validation("This design's settings cannot be read")); }
    const id = this.ids.generate();
    const { canvas, unreadable } = legacyInfographicToCanvas({ id, title: found.value.title, config, revision: 1 });
    const now = this.clock.now();
    const stored: StoredCanvas = { id, tenantId: ctx.tenant.tenantId, scope, mode: "PUBLISHED_ONLY", ...(portfolio ? {} : { projectId: found.value.projectId }), ownerId: found.value.createdById, title: found.value.title, canvas, sourceKind: "INFOGRAPHIC", sourceId: infographicId, createdAt: now, updatedAt: now };
    const made = await this.repo.create(stored);
    if (!made.ok) return made;
    if (!made.value) {
      const theirs = await this.repo.findBySource(ctx.tenant.tenantId, "INFOGRAPHIC", infographicId);
      if (!theirs.ok) return theirs;
      if (theirs.value) return ok({ canvas: dtoOf(theirs.value, ctx), created: false, unreadable: [] });
      return fail(DomainError.conflict("This design could not be opened as a canvas. Try again."));
    }
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "canvas.converted", entityType: "canvas", entityId: id, newValue: JSON.stringify({ from: "INFOGRAPHIC", sourceId: infographicId, unreadable: unreadable.length }) });
    return ok({ canvas: dtoOf(stored, ctx), created: true, unreadable: unreadable.map((u) => ({ widgetId: `section ${u.index + 1}`, reason: u.reason })) });
  }
}
