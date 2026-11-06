import { DomainError, MAX_CHART_NAME, Permissions, canEditSavedChart, canSeeSavedChart, pushChartVersion, validateChartSpec, type ChartVersion, type Result, type Role, type SavedChartScope } from "@donordesk/domain";
import type { SaveChartInput } from "@donordesk/contracts";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger, IClock, IIdGenerator } from "../../ports/core.js";
import type { ISavedChartRepository, StoredChart } from "../../ports/dashboards.js";
import type { VisibleProjects } from "../../services/visible-projects.js";

/**
 * Saved charts (Phase 34.1): the specification only, never data. Sharing follows the dashboards' rules: a personal chart is its owner's;
 * a project chart is shared with everyone who can see the project and may be made or changed by someone who manages projects. A chart
 * can only name a project the saver can see, and its specification is checked by the one validator the studio and the API share.
 */

const can = (ctx: AuthenticatedContext, permission: Parameters<typeof Permissions.can>[1]) => Permissions.can(ctx.tenant.role as Role, permission);
const fail = <T>(error: DomainError): Result<T, DomainError> => ({ ok: false, error });
const ok = <T>(value: T): Result<T, DomainError> => ({ ok: true, value });
const viewerOf = (ctx: AuthenticatedContext) => ({ userId: ctx.tenant.userId, canManageShared: can(ctx, "project.edit") });

export interface SavedChartDto {
  id: string;
  name: string;
  scope: SavedChartScope;
  projectId: string;
  mine: boolean;
  canEdit: boolean;
  spec: Record<string, unknown>;
  updatedAt: string;
}

const dto = (c: StoredChart, ctx: AuthenticatedContext): SavedChartDto => ({
  id: c.id, name: c.name, scope: c.scope, projectId: c.projectId, mine: c.ownerId === ctx.tenant.userId, canEdit: canEditSavedChart(c, viewerOf(ctx)), spec: c.spec, updatedAt: c.updatedAt.toISOString(),
});

/** A chart the person can see, in a project they can see; anything else does not exist as far as they can tell. */
async function load(repo: ISavedChartRepository, visible: Pick<VisibleProjects, "for">, ctx: AuthenticatedContext, id: string): Promise<Result<StoredChart, DomainError>> {
  const found = await repo.findById(id, ctx.tenant.tenantId);
  if (!found.ok) return found;
  if (!found.value || !canSeeSavedChart(found.value, viewerOf(ctx))) return fail(DomainError.notFound("Chart", id));
  const mine = await visible.for(ctx);
  if (!mine.ok) return mine;
  if (!mine.value.some((p) => p.id === found.value!.projectId)) return fail(DomainError.notFound("Chart", id));
  return ok(found.value);
}

export class ListSavedChartsHandler {
  constructor(private readonly repo: ISavedChartRepository, private readonly visible: Pick<VisibleProjects, "for">) {}

  async handle(ctx: AuthenticatedContext, projectId: string): Promise<Result<{ charts: SavedChartDto[] }, DomainError>> {
    if (!can(ctx, "project.view")) return fail(DomainError.forbidden("You cannot see charts"));
    const mine = await this.visible.for(ctx);
    if (!mine.ok) return mine;
    if (!mine.value.some((p) => p.id === projectId)) return fail(DomainError.notFound("Project", projectId));
    const listed = await this.repo.listForProject(ctx.tenant.tenantId, projectId, ctx.tenant.userId);
    if (!listed.ok) return listed;
    return ok({ charts: listed.value.filter((c) => canSeeSavedChart(c, viewerOf(ctx))).map((c) => dto(c, ctx)) });
  }
}

/** One chart with its earlier versions (the list carries none, to stay small). */
export interface SavedChartDetailDto extends SavedChartDto { versions: Array<{ at: string; name: string; spec: Record<string, unknown> }> }

export class GetSavedChartHandler {
  constructor(private readonly repo: ISavedChartRepository, private readonly visible: Pick<VisibleProjects, "for">) {}

  async handle(ctx: AuthenticatedContext, id: string): Promise<Result<SavedChartDetailDto, DomainError>> {
    if (!can(ctx, "project.view")) return fail(DomainError.forbidden("You cannot see charts"));
    const c = await load(this.repo, this.visible, ctx, id);
    return c.ok ? ok({ ...dto(c.value, ctx), versions: c.value.versions.map((v) => ({ at: v.at, name: v.name, spec: v.spec })) }) : c;
  }
}

export class SaveSavedChartHandler {
  constructor(private readonly ids: IIdGenerator, private readonly repo: ISavedChartRepository, private readonly visible: Pick<VisibleProjects, "for">, private readonly audit: IAuditLogger, private readonly clock: IClock) {}

  async handle(ctx: AuthenticatedContext, input: SaveChartInput, chartId?: string): Promise<Result<{ id: string; updatedAt: string }, DomainError>> {
    if (!can(ctx, "project.view")) return fail(DomainError.forbidden("You cannot save charts"));
    const name = input.name.trim();
    if (name.length === 0 || name.length > MAX_CHART_NAME) return fail(DomainError.validation(`A chart's name is 1 to ${MAX_CHART_NAME} characters.`));
    const problems = validateChartSpec(input.spec);
    if (problems.length > 0) return fail(DomainError.validation(problems[0]!.message, { problems }));

    const mine = await this.visible.for(ctx);
    if (!mine.ok) return mine;
    if (!mine.value.some((p) => p.id === input.projectId)) return fail(DomainError.notFound("Project", input.projectId));

    const now = this.clock.now();
    const spec = input.spec as Record<string, unknown>;
    if (!chartId) {
      if (input.scope === "PROJECT" && !can(ctx, "project.edit")) return fail(DomainError.forbidden("Only someone who manages projects can share a chart with a project"));
      const id = this.ids.generate();
      const created = await this.repo.create({ id, tenantId: ctx.tenant.tenantId, scope: input.scope, projectId: input.projectId, ownerId: ctx.tenant.userId, name, spec, versions: [], createdAt: now, updatedAt: now });
      if (!created.ok) return created;
      await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "chart.created", entityType: "saved_chart", entityId: id, projectId: input.projectId });
      return ok({ id, updatedAt: now.toISOString() });
    }

    const existing = await load(this.repo, this.visible, ctx, chartId);
    if (!existing.ok) return existing;
    if (!canEditSavedChart(existing.value, viewerOf(ctx))) return fail(DomainError.forbidden("You cannot change this chart"));
    if (existing.value.scope !== input.scope || existing.value.projectId !== input.projectId) return fail(DomainError.validation("A chart keeps the scope and project it was made with."));
    const expected = input.expectedUpdatedAt ? new Date(input.expectedUpdatedAt) : undefined;
    const replaced: ChartVersion = { at: now.toISOString(), by: ctx.tenant.userId, name: existing.value.name, spec: existing.value.spec };
    const versions = pushChartVersion(existing.value.versions, replaced, { name, spec });
    const saved = await this.repo.update({ ...existing.value, name, spec, versions, updatedAt: now }, expected);
    if (!saved.ok) return saved;
    if (!saved.value) return fail(DomainError.conflict("Someone else has changed this chart since you opened it. Nothing was saved. Reload the page to see their version, then make your changes again."));
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "chart.updated", entityType: "saved_chart", entityId: chartId, projectId: input.projectId });
    return ok({ id: chartId, updatedAt: now.toISOString() });
  }
}

export class DeleteSavedChartHandler {
  constructor(private readonly repo: ISavedChartRepository, private readonly visible: Pick<VisibleProjects, "for">, private readonly audit: IAuditLogger) {}

  async handle(ctx: AuthenticatedContext, id: string): Promise<Result<void, DomainError>> {
    if (!can(ctx, "project.view")) return fail(DomainError.forbidden("You cannot delete charts"));
    const c = await load(this.repo, this.visible, ctx, id);
    if (!c.ok) return c;
    if (!canEditSavedChart(c.value, viewerOf(ctx))) return fail(DomainError.forbidden("You cannot delete this chart"));
    const removed = await this.repo.delete(id, ctx.tenant.tenantId);
    if (!removed.ok) return removed;
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "chart.deleted", entityType: "saved_chart", entityId: id, projectId: c.value.projectId });
    return ok(undefined);
  }
}
