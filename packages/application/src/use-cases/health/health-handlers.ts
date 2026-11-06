import {
  DomainError, ProjectRiskTrend, err, lateActivities, ok, planAndCollectionFactors, toPlainDate, addDays,
  type PlainDate, type Result, type TenantId,
} from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IChecklistRepository } from "../../ports/compliance.js";
import type { IAuditLogger, IClock } from "../../ports/core.js";
import type { IRiskRefresh, IRiskTrendStore } from "../../ports/health.js";
import type { IProjectRepository } from "../../ports/projects.js";
import type { IReportingPeriodRepository } from "../../ports/reporting.js";
import type { ProjectHealth, ProjectHealthService } from "../../services/project-health-service.js";
import type { VisibleProjects } from "../../services/visible-projects.js";

export interface PortfolioHealthRow { projectId: string; title: string; band: ProjectHealth["band"]; label: string; reasons: string[] }

/** One project's standing: a label, the two biggest reasons, and the counts behind them. `project.view` is enforced by the route table. */
export class GetDeliveryHealthHandler {
  constructor(private readonly projects: IProjectRepository, private readonly health: ProjectHealthService, private readonly clock: IClock) {}

  async handle(ctx: AuthenticatedContext, projectId: string): Promise<Result<ProjectHealth, DomainError>> {
    const found = await this.projects.findById(projectId, ctx.tenant.tenantId);
    if (!found.ok) return found;
    if (!found.value) return err(DomainError.notFound("Project", projectId));
    const out = await this.health.forProjects(ctx.tenant.tenantId, [projectId], toPlainDate(this.clock.now())!);
    return out.ok ? ok(out.value[0]!) : out;
  }
}

/** One line per project the person can see: the label and the top reason. Archived and completed projects are left out. */
export class GetPortfolioHealthHandler {
  constructor(private readonly visible: VisibleProjects, private readonly health: ProjectHealthService, private readonly clock: IClock) {}

  async handle(ctx: AuthenticatedContext): Promise<Result<PortfolioHealthRow[], DomainError>> {
    const projects = await this.visible.for(ctx);
    if (!projects.ok) return projects;
    const live = projects.value.filter((p) => p.status === "ACTIVE" || p.status === "DRAFT" || p.status === "PAUSED");
    const out = await this.health.forProjects(ctx.tenant.tenantId, live.map((p) => p.id), toPlainDate(this.clock.now())!);
    if (!out.ok) return out;
    const titleOf = new Map(live.map((p) => [p.id, p.title]));
    return ok(out.value.map((h) => ({ projectId: h.projectId, title: titleOf.get(h.projectId) ?? "", band: h.band, label: h.label, reasons: h.reasons.slice(0, 1) })));
  }
}

const FINISHED = ["APPROVED", "EXPORTED", "SENT", "SUBMITTED", "CLOSED"];

/**
 * Keeps one risk snapshot per project per day, from the same facts as the health label plus the compliance counts it always
 * had. The stored score is never shown to people; it is the history behind the label.
 */
export class RefreshProjectRiskHandler implements IRiskRefresh {
  constructor(
    private readonly projects: IProjectRepository, private readonly health: ProjectHealthService, private readonly checklist: IChecklistRepository,
    private readonly periods: IReportingPeriodRepository, private readonly store: IRiskTrendStore, private readonly audit: IAuditLogger,
  ) {}

  async refreshAll(tenantId: TenantId, today: PlainDate): Promise<void> {
    try {
      const all = await this.projects.listByTenant(tenantId);
      if (!all.ok) return;
      const live = all.value.filter((p) => p.status === "ACTIVE" || p.status === "DRAFT" || p.status === "PAUSED");
      const healths = await this.health.forProjects(tenantId, live.map((p) => p.id), today);
      if (!healths.ok) return;
      let saved = 0;
      for (const h of healths.value) {
        const items = await this.checklist.findByProject(h.projectId, tenantId);
        const periods = await this.periods.findByProject(h.projectId, tenantId);
        if (!items.ok || !periods.ok) continue;
        const open = items.value.filter((i) => !["RESOLVED", "ACCEPTED_RISK", "NOT_APPLICABLE"].includes(i.status));
        const trend = ProjectRiskTrend.create({
          id: `${h.projectId}:${today}`, tenantId: tenantId.toString(), projectId: h.projectId,
          periodStart: new Date(`${today}T00:00:00.000Z`), periodEnd: new Date(`${addDays(today, 1)}T00:00:00.000Z`),
        });
        trend.updateMetrics({
          missingEvidenceCount: open.filter((i) => i.type === "MISSING_EVIDENCE").length,
          deadlineSlipsCount: periods.value.filter((p) => !p.isCancelled && !FINISHED.includes(p.status.toString()) && toPlainDate(p.deadline)! < today).length,
          overdueChecklistItemsCount: open.filter((i) => i.dueDate && toPlainDate(i.dueDate)! < today).length,
          contributingFactors: planAndCollectionFactors({ lateActivities: lateActivities(h.health), valuesOverdue: h.health.valuesOverdue }),
        });
        const stored = await this.store.save(trend);
        if (stored.ok) saved += 1;
      }
      if (saved > 0) await this.audit.record({ tenantId, actorId: "system:reminders", eventType: "risk.snapshots_saved", entityType: "organization", entityId: tenantId.toString(), newValue: JSON.stringify({ day: today, projects: saved }) });
    } catch {
      /* the risk history is additive: a failure here never stops the reminders */
    }
  }
}

export interface RiskTrendDto {
  projectId: string;
  level: string;
  /** For people who manage the work; not shown on screen. */
  score: number;
  factors: Array<{ type: string; description: string; severity: string }>;
  history: Array<{ day: string; level: string }>;
}

/** The latest stored snapshot of a project and its recent levels. */
export class GetRiskTrendHandler {
  constructor(private readonly store: IRiskTrendStore, private readonly projects: IProjectRepository) {}

  async handle(ctx: AuthenticatedContext, projectId: string): Promise<Result<RiskTrendDto | null, DomainError>> {
    const found = await this.projects.findById(projectId, ctx.tenant.tenantId);
    if (!found.ok) return found;
    if (!found.value) return err(DomainError.notFound("Project", projectId));
    const rows = await this.store.history(projectId, ctx.tenant.tenantId, 30);
    if (!rows.ok) return rows;
    const latest = rows.value[0];
    if (!latest) return ok(null);
    return ok({
      projectId, level: latest.riskLevel, score: latest.riskScore,
      factors: latest.contributingFactors.map((f) => ({ type: f.type, description: f.description, severity: f.severity })),
      history: rows.value.map((r) => ({ day: r.periodStart.toISOString().slice(0, 10), level: r.riskLevel })),
    });
  }
}

