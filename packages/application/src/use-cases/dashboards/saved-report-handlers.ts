import { DomainError, MAX_REPORT_NAME, Permissions, canEditSavedChart, canSeeSavedChart, validateReportQuery, type ReportQuery, type Result, type Role, type SavedChartScope } from "@donordesk/domain";
import type { SaveReportInput } from "@donordesk/contracts";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger, IClock, IIdGenerator } from "../../ports/core.js";
import type { ISavedReportRepository, StoredReport } from "../../ports/dashboards.js";
import type { VisibleProjects } from "../../services/visible-projects.js";

/** Saved reports (Phase 34.5): the question only. Sharing follows the saved charts' rules (personal = owner's; project = everyone who can see the project, managed by those who manage projects). */
const can = (ctx: AuthenticatedContext, permission: Parameters<typeof Permissions.can>[1]) => Permissions.can(ctx.tenant.role as Role, permission);
const fail = <T>(error: DomainError): Result<T, DomainError> => ({ ok: false, error });
const ok = <T>(value: T): Result<T, DomainError> => ({ ok: true, value });
const viewerOf = (ctx: AuthenticatedContext) => ({ userId: ctx.tenant.userId, canManageShared: can(ctx, "project.edit") });

export interface SavedReportDto { id: string; name: string; scope: SavedChartScope; projectId: string; mine: boolean; canEdit: boolean; query: Record<string, unknown>; updatedAt: string }
const dto = (r: StoredReport, ctx: AuthenticatedContext): SavedReportDto => ({ id: r.id, name: r.name, scope: r.scope, projectId: r.projectId, mine: r.ownerId === ctx.tenant.userId, canEdit: canEditSavedChart(r, viewerOf(ctx)), query: r.query, updatedAt: r.updatedAt.toISOString() });

async function visibleProject(visible: Pick<VisibleProjects, "for">, ctx: AuthenticatedContext, projectId: string): Promise<Result<true, DomainError>> {
  const mine = await visible.for(ctx);
  if (!mine.ok) return mine;
  return mine.value.some((p) => p.id === projectId) ? ok(true) : fail(DomainError.notFound("Project", projectId));
}

async function load(repo: ISavedReportRepository, visible: Pick<VisibleProjects, "for">, ctx: AuthenticatedContext, id: string): Promise<Result<StoredReport, DomainError>> {
  const found = await repo.findById(id, ctx.tenant.tenantId);
  if (!found.ok) return found;
  if (!found.value || !canSeeSavedChart(found.value, viewerOf(ctx))) return fail(DomainError.notFound("Report", id));
  const seen = await visibleProject(visible, ctx, found.value.projectId);
  return seen.ok ? ok(found.value) : fail(DomainError.notFound("Report", id));
}

export class ListSavedReportsHandler {
  constructor(private readonly repo: ISavedReportRepository, private readonly visible: Pick<VisibleProjects, "for">) {}
  async handle(ctx: AuthenticatedContext, projectId: string): Promise<Result<{ reports: SavedReportDto[] }, DomainError>> {
    if (!can(ctx, "project.view")) return fail(DomainError.forbidden("You cannot see reports"));
    const seen = await visibleProject(this.visible, ctx, projectId);
    if (!seen.ok) return seen;
    const listed = await this.repo.listForProject(ctx.tenant.tenantId, projectId, ctx.tenant.userId);
    return listed.ok ? ok({ reports: listed.value.filter((r) => canSeeSavedChart(r, viewerOf(ctx))).map((r) => dto(r, ctx)) }) : listed;
  }
}

export class SaveSavedReportHandler {
  constructor(private readonly ids: IIdGenerator, private readonly repo: ISavedReportRepository, private readonly visible: Pick<VisibleProjects, "for">, private readonly audit: IAuditLogger, private readonly clock: IClock) {}

  async handle(ctx: AuthenticatedContext, input: SaveReportInput, reportId?: string): Promise<Result<{ id: string; updatedAt: string }, DomainError>> {
    if (!can(ctx, "project.view")) return fail(DomainError.forbidden("You cannot save reports"));
    const name = input.name.trim();
    if (name.length === 0 || name.length > MAX_REPORT_NAME) return fail(DomainError.validation(`A report's name is 1 to ${MAX_REPORT_NAME} characters.`));
    const problems = validateReportQuery(input.query as unknown as ReportQuery);
    if (problems.length > 0) return fail(DomainError.validation(problems[0]!.message, { problems }));
    const seen = await visibleProject(this.visible, ctx, input.projectId);
    if (!seen.ok) return seen;
    const now = this.clock.now();
    const query = input.query as Record<string, unknown>;

    if (!reportId) {
      if (input.scope === "PROJECT" && !can(ctx, "project.edit")) return fail(DomainError.forbidden("Only someone who manages projects can share a report with a project"));
      const id = this.ids.generate();
      const created = await this.repo.create({ id, tenantId: ctx.tenant.tenantId, scope: input.scope, projectId: input.projectId, ownerId: ctx.tenant.userId, name, query, createdAt: now, updatedAt: now });
      if (!created.ok) return created;
      await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "report_query.created", entityType: "saved_report", entityId: id, projectId: input.projectId });
      return ok({ id, updatedAt: now.toISOString() });
    }
    const existing = await load(this.repo, this.visible, ctx, reportId);
    if (!existing.ok) return existing;
    if (!canEditSavedChart(existing.value, viewerOf(ctx))) return fail(DomainError.forbidden("You cannot change this report"));
    if (existing.value.scope !== input.scope || existing.value.projectId !== input.projectId) return fail(DomainError.validation("A report keeps the scope and project it was made with."));
    const saved = await this.repo.update({ ...existing.value, name, query, updatedAt: now }, input.expectedUpdatedAt ? new Date(input.expectedUpdatedAt) : undefined);
    if (!saved.ok) return saved;
    if (!saved.value) return fail(DomainError.conflict("Someone else has changed this report since you opened it. Nothing was saved. Reload the page to see their version, then make your changes again."));
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "report_query.updated", entityType: "saved_report", entityId: reportId, projectId: input.projectId });
    return ok({ id: reportId, updatedAt: now.toISOString() });
  }
}

export class DeleteSavedReportHandler {
  constructor(private readonly repo: ISavedReportRepository, private readonly visible: Pick<VisibleProjects, "for">, private readonly audit: IAuditLogger) {}
  async handle(ctx: AuthenticatedContext, id: string): Promise<Result<void, DomainError>> {
    if (!can(ctx, "project.view")) return fail(DomainError.forbidden("You cannot delete reports"));
    const r = await load(this.repo, this.visible, ctx, id);
    if (!r.ok) return r;
    if (!canEditSavedChart(r.value, viewerOf(ctx))) return fail(DomainError.forbidden("You cannot delete this report"));
    const removed = await this.repo.delete(id, ctx.tenant.tenantId);
    if (!removed.ok) return removed;
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "report_query.deleted", entityType: "saved_report", entityId: id, projectId: r.value.projectId });
    return ok(undefined);
  }
}
