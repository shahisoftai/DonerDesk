import type { Result } from "@donordesk/domain";
import { DomainError, ChecklistItem, checklistTemplateForReportType, type Severity } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IChecklistRepository, IChecklistDetector } from "../../ports/compliance.js";
import type { IIdGenerator, IAuditLogger } from "../../ports/core.js";
import type {
  IReportingPeriodRepository,
  IReportDraftRepository,
  IReportSectionRepository,
} from "../../ports/reporting.js";
import type { IActivityUpdateRepository } from "../../ports/activities.js";
import type { IEvidenceRepository } from "../../ports/evidence.js";
import type { IDonorTemplateRepository } from "../../ports/templates.js";
import type { IIndicatorUpdateRepository } from "../../ports/logframe.js";

export class DetectMissingEvidenceHandler {
  constructor(
    private readonly ids: IIdGenerator,
    private readonly checklist: IChecklistRepository,
    private readonly detector: IChecklistDetector,
    private readonly periods: IReportingPeriodRepository,
    private readonly drafts: IReportDraftRepository,
    private readonly templates: IDonorTemplateRepository,
    private readonly indicatorUpdates: IIndicatorUpdateRepository,
    private readonly sections: IReportSectionRepository,
    private readonly activities: IActivityUpdateRepository,
    private readonly evidence: IEvidenceRepository,
    private readonly audit: IAuditLogger,
  ) {}

  async handle(ctx: AuthenticatedContext, reportingPeriodId: string): Promise<Result<{ created: number }, DomainError>> {
    const periodResult = await this.periods.findById(reportingPeriodId, ctx.tenant.tenantId);
    if (!periodResult.ok) return periodResult;
    if (!periodResult.value) return { ok: false, error: DomainError.notFound("ReportingPeriod", reportingPeriodId) };
    const period = periodResult.value;

    const requiredAnnexes: string[] = [];
    if (period.donorTemplateId) {
      const t = await this.templates.findById(period.donorTemplateId, ctx.tenant.tenantId);
      if (t.ok && t.value) requiredAnnexes.push(...t.value.requiredAnnexes);
    }

    const updates = await this.indicatorUpdates.findByReportingPeriod(reportingPeriodId, ctx.tenant.tenantId);
    if (!updates.ok) return updates;
    const verified = updates.value.filter((u) => u.verificationStatus === "VERIFIED").length;

    const ev = await this.evidence.search({ projectId: period.projectId, reportingPeriodId, pageSize: 200 }, ctx.tenant.tenantId);
    if (!ev.ok) return ev;
    const evidenceCount = ev.value.total;

    const draftsResult = await this.drafts.findByReportingPeriod(reportingPeriodId, ctx.tenant.tenantId);
    let sectionStatuses: Array<{ sectionId: string; status: string; hasUnsupportedClaims: boolean }> = [];
    const firstDraft = draftsResult.ok ? draftsResult.value[0] : undefined;
    if (firstDraft) {
      const sectionsResult = await this.sections.findByReportDraft(firstDraft.id, ctx.tenant.tenantId);
      sectionStatuses = sectionsResult.ok
        ? sectionsResult.value.map((s) => ({
            sectionId: s.id,
            status: s.status,
            hasUnsupportedClaims: s.unsupportedClaims.length > 0,
          }))
        : [];
    }

    const activitiesResult = await this.activities.findByReportingPeriod(reportingPeriodId, ctx.tenant.tenantId);
    const activitiesCount = activitiesResult.ok ? activitiesResult.value.length : 0;

    const suggestions = await this.detector.detect({
      reportingPeriodId,
      projectId: period.projectId,
      tenantId: ctx.tenant.tenantId,
      requiredAnnexes,
      requiredActivities: [],
      requiredIndicators: [],
      activitiesCount,
      verifiedIndicatorCount: verified,
      totalIndicatorCount: updates.value.length,
      evidenceCount,
      requiredEvidenceCount: requiredAnnexes.length * 2 + 5,
      sectionStatuses,
    });

    // Baseline items configured for the report type are part of every period's
    // compliance checklist (config-driven; see checklist-template.ts).
    const baseline = checklistTemplateForReportType(period.reportType).items.map((t) => ({
      type: t.type,
      title: t.title,
      description: t.description,
      severity: t.severity as Severity,
      relatedEntityType: undefined as string | undefined,
      relatedEntityId: undefined as string | undefined,
    }));
    const combined = [...baseline, ...suggestions];

    // Dedupe: never create a second OPEN/IN_PROGRESS item for the same
    // (type, relatedEntityId) concern already tracked in this period.
    const existingResult = await this.checklist.findByReportingPeriod(reportingPeriodId, ctx.tenant.tenantId);
    if (!existingResult.ok) return existingResult;
    const existingActiveKeys = new Set(
      existingResult.value
        .filter((i) => i.status === "OPEN" || i.status === "IN_PROGRESS")
        .map((i) => `${i.type}:${i.relatedEntityId ?? ""}`),
    );
    const seenKeys = new Set<string>();

    let created = 0;
    for (const s of combined) {
      const key = `${s.type}:${s.relatedEntityId ?? ""}`;
      if (existingActiveKeys.has(key)) continue;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      const id = this.ids.generate();
      const item = ChecklistItem.create({
        id,
        tenantId: ctx.tenant.tenantId.toString(),
        projectId: period.projectId,
        reportingPeriodId,
        type: s.type,
        title: s.title,
        description: s.description,
        severity: s.severity,
        relatedEntityType: s.relatedEntityType,
        relatedEntityId: s.relatedEntityId,
      });
      const saved = await this.checklist.create(item);
      if (saved.ok) created++;
    }

    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "compliance.checklist.detected",
      entityType: "reporting_period",
      entityId: reportingPeriodId,
      projectId: period.projectId,
      newValue: `created=${created}`,
    });

    return { ok: true, value: { created } };
  }
}
