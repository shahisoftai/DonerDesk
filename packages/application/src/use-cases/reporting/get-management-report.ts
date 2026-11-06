import {
  DomainError, EVIDENCE_VERIFICATION_STATUSES, buildManagementReport, cellPercentOfTarget, cellVariance, daysBetween, indexCells, lateActivities,
  toPlainDate, type DataSheet, type ManagementReportInput, type ManagementReportSection, type Result,
} from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IClock } from "../../ports/core.js";
import type { IActivityUpdateRepository } from "../../ports/activities.js";
import type { IEvidenceRepository } from "../../ports/evidence.js";
import type { IProjectRepository } from "../../ports/projects.js";
import type { IProjectRiskRepository } from "../../ports/risks.js";
import type { IReportingPeriodRepository } from "../../ports/reporting.js";
import type { ProjectHealthService } from "../../services/project-health-service.js";
import type { CalculateReadinessHandler } from "../compliance/calculate-readiness.js";

type SheetReader = { handle(ctx: AuthenticatedContext, projectId: string): Promise<Result<DataSheet, DomainError>> };

/**
 * The standard management report of one project, assembled from what the product already knows (delivery health, the data sheet,
 * reports, risks, evidence and activities) and nothing new. The tables themselves are `buildManagementReport`.
 */
export class GetManagementReportHandler {
  constructor(
    private readonly projects: IProjectRepository, private readonly health: ProjectHealthService, private readonly sheet: SheetReader,
    private readonly risks: IProjectRiskRepository, private readonly periods: IReportingPeriodRepository, private readonly evidence: IEvidenceRepository,
    private readonly activities: IActivityUpdateRepository, private readonly clock: IClock,
    /** Readiness is derived live, like the reports list: the stored score is not refreshed when a report is reviewed or submitted. */
    private readonly readiness?: CalculateReadinessHandler,
  ) {}

  async handle(ctx: AuthenticatedContext, projectId: string): Promise<Result<{ sections: ManagementReportSection[]; today: string; projectTitle: string }, DomainError>> {
    const tenantId = ctx.tenant.tenantId;
    const found = await this.projects.findById(projectId, tenantId);
    if (!found.ok) return found;
    if (!found.value) return { ok: false, error: DomainError.notFound("Project", projectId) };
    const project = found.value;
    const today = toPlainDate(this.clock.now())!;

    const [health, sheet, risks, periods, activities] = await Promise.all([
      this.health.forProjects(tenantId, [projectId], today), this.sheet.handle(ctx, projectId), this.risks.findByProject(projectId, tenantId),
      this.periods.findByProject(projectId, tenantId), this.activities.findByProject(projectId, tenantId),
    ]);
    if (!health.ok) return health;
    if (!sheet.ok) return sheet;
    if (!risks.ok) return risks;
    if (!periods.ok) return periods;
    if (!activities.ok) return activities;

    const byStatus: Record<string, number> = {};
    let total = 0;
    for (const status of EVIDENCE_VERIFICATION_STATUSES) {
      const r = await this.evidence.search({ projectId, verificationStatus: status, page: 1, pageSize: 1 }, tenantId);
      if (!r.ok) return r;
      byStatus[status] = r.value.total;
      total += r.value.total;
    }

    const h = health.value[0];
    const cells = indexCells(sheet.value);
    const periodById = new Map(sheet.value.periods.map((p) => [p.id, p]));
    const indicators: ManagementReportInput["indicators"] = sheet.value.indicators.map((indicator) => {
      // The latest period that has a recorded value for this indicator.
      let latest: { period: (typeof sheet.value.periods)[number]; cell: NonNullable<ReturnType<typeof cells.get>> } | null = null;
      for (const period of sheet.value.periods) {
        const cell = cells.get(`${indicator.id}|${period.id}`);
        if (!cell || (cell.cumulativeValue.trim() === "" && cell.periodValue.trim() === "")) continue;
        if (!latest || period.end > latest.period.end) latest = { period, cell };
      }
      return {
        code: indicator.code, name: indicator.name, unit: indicator.unit ?? "", target: indicator.target,
        latest: latest ? (latest.cell.cumulativeValue.trim() !== "" ? latest.cell.cumulativeValue : latest.cell.periodValue) : null,
        asOf: latest?.period.end ?? null,
        percentOfTarget: latest ? cellPercentOfTarget(indicator, latest.cell) : "",
        variance: latest ? cellVariance(indicator, latest.period, latest.cell) : "",
        status: latest?.cell.status.toLowerCase() ?? "",
      };
    });

    const livePeriods: ManagementReportInput["periods"] = await Promise.all(
      periods.value
        .filter((p) => !p.isCancelled)
        .sort((a, b) => a.duration.start.getTime() - b.duration.start.getTime())
        .map(async (p) => {
          const live = this.readiness ? await this.readiness.handle(ctx, p.id) : undefined;
          return {
            label: periodById.get(p.id)?.label ?? toPlainDate(p.duration.start)!, reportType: p.reportType, status: p.status.toString(),
            deadline: toPlainDate(p.deadline)!, daysUntil: daysBetween(today, toPlainDate(p.deadline)!),
            readiness: live?.ok ? live.value.overall : p.readinessScore,
          };
        }),
    );

    const accepted = activities.value.filter((a) => a.status === "ACCEPTED");
    const sections = buildManagementReport({
      project: {
        title: project.title, code: project.projectCode, donor: project.donorName, country: project.country, sector: project.sector ?? "",
        start: toPlainDate(project.duration.start)!, end: toPlainDate(project.duration.end)!, status: project.status,
      },
      today,
      delivery: h
        ? { label: h.label, reasons: h.reasons, planned: h.health.planned, lateActivities: lateActivities(h.health), valuesOverdue: h.health.valuesOverdue }
        : { label: "No plan yet", reasons: [], planned: 0, lateActivities: 0, valuesOverdue: 0 },
      indicators,
      periods: livePeriods,
      risks: risks.value.map((r) => ({ title: r.title, kind: r.snapshot().kind, seriousness: r.seriousness, status: r.status, reviewBy: r.reviewBy })),
      evidence: { total, byStatus },
      activities: { total: activities.value.length, accepted: accepted.length, participants: accepted.reduce((n, a) => n + (a.participantsTotal ?? 0), 0) },
    });
    return { ok: true, value: { sections, today, projectTitle: project.title } };
  }
}
