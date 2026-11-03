import {
  DomainError, HEADLINE_HEIGHT, Permissions, SECTOR_TEMPLATES, TEMPLATE_SECTORS, applyTemplate, headlinePicks, settleLayout, templateProblems,
  type DashboardTemplate, type DashboardWidget, type Result, type Role, type SectorKey,
} from "@donordesk/domain";
import type { ApplyDashboardTemplateInput, DashboardTemplateBody } from "@donordesk/contracts";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger, IClock, IIdGenerator } from "../../ports/core.js";
import type { IDashboardTemplateRepository, StoredDashboardTemplate } from "../../ports/dashboards.js";
import type { SaveDashboardHandler } from "./dashboard-handlers.js";

/**
 * Dashboard templates (Phase 34.3). Built-in templates live in code and are drafts like every template; the organisation keeps its own
 * copies, which anyone who manages projects may change. Applying a template to a project turns its roles (mapped by the person to the
 * project's own indicators) into a dashboard: a chart whose roles are not chosen is left out and named, never drawn from a guess.
 */

const can = (ctx: AuthenticatedContext, permission: Parameters<typeof Permissions.can>[1]) => Permissions.can(ctx.tenant.role as Role, permission);
const fail = <T>(error: DomainError): Result<T, DomainError> => ({ ok: false, error });
const ok = <T>(value: T): Result<T, DomainError> => ({ ok: true, value });

export interface TemplateSummaryDto {
  id: string;
  title: string;
  description: string;
  sector: SectorKey;
  sectorLabel: string;
  audience: DashboardTemplate["audience"];
  origin: "BUILT_IN" | "ORGANISATION";
  basedOn?: string;
  revision: number;
  chartCount: number;
  roleCount: number;
  updatedAt?: string;
  canEdit: boolean;
}

export interface TemplateDetailDto { template: DashboardTemplate; updatedAt?: string; canEdit: boolean }

const summary = (t: DashboardTemplate, canEdit: boolean, updatedAt?: Date): TemplateSummaryDto => ({
  id: t.id, title: t.title, description: t.description, sector: t.sector, sectorLabel: TEMPLATE_SECTORS[t.sector]?.label ?? t.sector, audience: t.audience, origin: t.origin,
  ...(t.basedOn ? { basedOn: t.basedOn } : {}), revision: t.revision, chartCount: t.widgets.filter((w) => w.kind === "CHART").length, roleCount: t.roles.length,
  ...(updatedAt ? { updatedAt: updatedAt.toISOString() } : {}), canEdit,
});

async function find(repo: IDashboardTemplateRepository, ctx: AuthenticatedContext, id: string): Promise<Result<{ template: DashboardTemplate; stored?: StoredDashboardTemplate }, DomainError>> {
  const builtIn = SECTOR_TEMPLATES.find((t) => t.id === id);
  if (builtIn) return ok({ template: builtIn });
  const found = await repo.findById(id, ctx.tenant.tenantId);
  if (!found.ok) return found;
  return found.value ? ok({ template: found.value.template, stored: found.value }) : fail(DomainError.notFound("Template", id));
}

export class ListDashboardTemplatesHandler {
  constructor(private readonly repo: IDashboardTemplateRepository) {}

  async handle(ctx: AuthenticatedContext): Promise<Result<{ templates: TemplateSummaryDto[] }, DomainError>> {
    if (!can(ctx, "project.view")) return fail(DomainError.forbidden("You cannot see dashboard templates"));
    const own = await this.repo.list(ctx.tenant.tenantId);
    if (!own.ok) return own;
    const edit = can(ctx, "project.edit");
    return ok({ templates: [...own.value.map((s) => summary(s.template, edit, s.updatedAt)), ...SECTOR_TEMPLATES.map((t) => summary(t, false))] });
  }
}

export class GetDashboardTemplateHandler {
  constructor(private readonly repo: IDashboardTemplateRepository) {}

  async handle(ctx: AuthenticatedContext, id: string): Promise<Result<TemplateDetailDto, DomainError>> {
    if (!can(ctx, "project.view")) return fail(DomainError.forbidden("You cannot see dashboard templates"));
    const f = await find(this.repo, ctx, id);
    if (!f.ok) return f;
    return ok({ template: f.value.template, ...(f.value.stored ? { updatedAt: f.value.stored.updatedAt.toISOString() } : {}), canEdit: Boolean(f.value.stored) && can(ctx, "project.edit") });
  }
}

export class SaveDashboardTemplateHandler {
  constructor(private readonly ids: IIdGenerator, private readonly repo: IDashboardTemplateRepository, private readonly audit: IAuditLogger, private readonly clock: IClock) {}

  /** Makes the organisation's template (a copy of a built-in or a new one), or changes one it already has. */
  async handle(ctx: AuthenticatedContext, body: DashboardTemplateBody, templateId?: string): Promise<Result<{ id: string; updatedAt: string; revision: number }, DomainError>> {
    if (!can(ctx, "project.edit")) return fail(DomainError.forbidden("Only someone who manages projects can change dashboard templates"));
    if (!(body.sector in TEMPLATE_SECTORS)) return fail(DomainError.validation("This sector is not known."));
    const now = this.clock.now();
    const existing = templateId ? await this.repo.findById(templateId, ctx.tenant.tenantId) : undefined;
    if (existing && !existing.ok) return existing;
    if (templateId && !existing?.value) return fail(DomainError.notFound("Template", templateId));
    const id = templateId ?? this.ids.generate();
    const template: DashboardTemplate = {
      id, sector: body.sector as SectorKey, title: body.title.trim(), description: body.description, audience: body.audience, status: "DRAFT", origin: "ORGANISATION",
      ...(body.basedOn ? { basedOn: body.basedOn } : {}), revision: (existing?.value?.template.revision ?? 0) + 1,
      roles: body.roles as unknown as DashboardTemplate["roles"], widgets: body.widgets as unknown as DashboardTemplate["widgets"],
    };
    const problems = templateProblems(template);
    if (problems.length > 0) return fail(DomainError.validation(problems[0]!.message, { problems }));

    if (!templateId) {
      const created = await this.repo.create({ id, tenantId: ctx.tenant.tenantId, ownerId: ctx.tenant.userId, template, createdAt: now, updatedAt: now });
      if (!created.ok) return created;
      await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "dashboard_template.created", entityType: "dashboard_template", entityId: id });
      return ok({ id, updatedAt: now.toISOString(), revision: template.revision });
    }
    const expected = body.expectedUpdatedAt ? new Date(body.expectedUpdatedAt) : undefined;
    const saved = await this.repo.update({ ...existing!.value!, template, updatedAt: now }, expected);
    if (!saved.ok) return saved;
    if (!saved.value) return fail(DomainError.conflict("Someone else has changed this template since you opened it. Nothing was saved. Reload the page to see their version, then make your changes again."));
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "dashboard_template.updated", entityType: "dashboard_template", entityId: id });
    return ok({ id, updatedAt: now.toISOString(), revision: template.revision });
  }
}

export class DeleteDashboardTemplateHandler {
  constructor(private readonly repo: IDashboardTemplateRepository, private readonly audit: IAuditLogger) {}

  async handle(ctx: AuthenticatedContext, id: string): Promise<Result<void, DomainError>> {
    if (!can(ctx, "project.edit")) return fail(DomainError.forbidden("Only someone who manages projects can delete dashboard templates"));
    const found = await this.repo.findById(id, ctx.tenant.tenantId);
    if (!found.ok) return found;
    if (!found.value) return fail(DomainError.notFound("Template", id));
    const removed = await this.repo.delete(id, ctx.tenant.tenantId);
    if (!removed.ok) return removed;
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "dashboard_template.deleted", entityType: "dashboard_template", entityId: id });
    return ok(undefined);
  }
}

export interface AppliedTemplateDto { dashboardId: string; updatedAt: string; chartsLeftOut: Array<{ title: string; missingRoles: string[] }> }

export class ApplyDashboardTemplateHandler {
  constructor(private readonly ids: IIdGenerator, private readonly repo: IDashboardTemplateRepository, private readonly save: Pick<SaveDashboardHandler, "handle">) {}

  /**
   * Makes a dashboard for a project from a template and the person's role choices. The dashboard is saved by the ordinary dashboard
   * handler, so its sharing and project-visibility rules apply unchanged. Charts with a role not chosen are left out and returned by name.
   */
  async handle(ctx: AuthenticatedContext, templateId: string, input: ApplyDashboardTemplateInput): Promise<Result<AppliedTemplateDto, DomainError>> {
    if (!can(ctx, "project.view")) return fail(DomainError.forbidden("You cannot make dashboards"));
    const f = await find(this.repo, ctx, templateId);
    if (!f.ok) return f;
    const applied = applyTemplate(f.value.template, input.mapping);
    const widgets: DashboardWidget[] = [];
    const left: AppliedTemplateDto["chartsLeftOut"] = [];
    for (const a of applied.widgets) {
      const base = { id: this.ids.generate().replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40), projectId: input.projectId, x: a.widget.x, y: a.widget.y, w: a.widget.w, h: a.widget.h };
      if (a.widget.kind === "TEXT") widgets.push({ ...base, kind: "TEXT", text: a.widget.text ?? "" });
      else if (a.state === "READY" && a.spec) widgets.push({ ...base, kind: "CHART", spec: a.spec });
      else left.push({ title: a.widget.title, missingRoles: a.missingRoles });
    }
    if (widgets.length === 0) return fail(DomainError.validation("None of this template's charts can be drawn until you choose which indicators it should use."));
    // A headline row of KPI tiles for the mapped roles goes first; the charts move down to make room.
    const headline = headlinePicks(f.value.template.roles, input.mapping, widgets.length);
    if (headline.length > 0) {
      for (let i = 0; i < widgets.length; i++) widgets[i] = { ...widgets[i]!, y: widgets[i]!.y + HEADLINE_HEIGHT };
      headline.forEach((h) => widgets.unshift({ id: this.ids.generate().replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40), projectId: input.projectId, kind: "KPI", kpi: { indicatorId: h.indicatorId, includeDraft: true }, x: h.x, y: 0, w: h.w, h: HEADLINE_HEIGHT }));
    }
    const saved = await this.save.handle(ctx, { name: input.name, scope: input.scope, projectId: input.scope === "PROJECT" ? input.projectId : undefined, widgets: settleLayout(widgets) as never } as never);
    if (!saved.ok) return saved;
    return ok({ dashboardId: saved.value.id, updatedAt: saved.value.updatedAt, chartsLeftOut: left });
  }
}
