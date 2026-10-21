import {
  buildPortfolioRow, lateActivities, ok, portfolioTotals, rankPortfolio, toPlainDate,
  type DomainError, type PortfolioRow, type PortfolioTotals, type Result,
} from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IClock } from "../../ports/core.js";
import type { IReportingPeriodRepository } from "../../ports/reporting.js";
import type { IProjectRiskRepository } from "../../ports/risks.js";
import type { ProjectHealthService } from "../../services/project-health-service.js";
import type { VisibleProjects } from "../../services/visible-projects.js";

export interface PortfolioOverview {
  totals: PortfolioTotals;
  rows: PortfolioRow[];
}

/**
 * The portfolio dashboard: one row per live project the person can see, with delivery, problems and risks, and reporting side by side.
 * Delivery comes from the same `ProjectHealthService` as the project card, so the two cannot disagree; the rest is read, never invented.
 */
export class GetPortfolioOverviewHandler {
  constructor(
    private readonly visible: VisibleProjects, private readonly health: ProjectHealthService, private readonly risks: IProjectRiskRepository,
    private readonly periods: IReportingPeriodRepository, private readonly clock: IClock,
  ) {}

  async handle(ctx: AuthenticatedContext): Promise<Result<PortfolioOverview, DomainError>> {
    const projects = await this.visible.for(ctx);
    if (!projects.ok) return projects;
    const live = projects.value.filter((p) => p.status === "ACTIVE" || p.status === "DRAFT" || p.status === "PAUSED");
    const today = toPlainDate(this.clock.now())!;
    const healths = await this.health.forProjects(ctx.tenant.tenantId, live.map((p) => p.id), today);
    if (!healths.ok) return healths;
    const healthOf = new Map(healths.value.map((h) => [h.projectId, h]));
    const rows: PortfolioRow[] = [];
    for (const project of live) {
      const h = healthOf.get(project.id);
      if (!h) continue;
      const [risks, periods] = await Promise.all([this.risks.findByProject(project.id, ctx.tenant.tenantId), this.periods.findByProject(project.id, ctx.tenant.tenantId)]);
      if (!risks.ok) return risks;
      if (!periods.ok) return periods;
      rows.push(buildPortfolioRow({
        projectId: project.id, title: project.title, donorName: project.donorName, country: project.country, status: project.status,
        health: { band: h.band, label: h.label, reasons: h.reasons, lateActivities: lateActivities(h.health), valuesOverdue: h.health.valuesOverdue },
        risks: risks.value.map((r) => ({ status: r.status, seriousness: r.seriousness, reviewBy: r.reviewBy })),
        periods: periods.value.map((p) => ({ id: p.id, deadline: toPlainDate(p.deadline)!, status: p.status.toString(), readinessScore: p.readinessScore, cancelled: p.isCancelled })),
      }, today));
    }
    const ranked = rankPortfolio(rows);
    return ok({ totals: portfolioTotals(ranked), rows: ranked });
  }
}
