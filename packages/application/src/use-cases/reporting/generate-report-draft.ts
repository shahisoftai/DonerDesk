import type { Result } from "@donordesk/domain";
import { DomainError, ReportDraft, ReportSection } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type {
  IReportingPeriodRepository,
  IReportDraftRepository,
  IReportSectionRepository,
  IReportDraftGenerator,
} from "../../ports/reporting.js";
import type {
  IProjectRepository,
} from "../../ports/projects.js";
import type { ILogframeRepository, IIndicatorRepository, IIndicatorUpdateRepository } from "../../ports/logframe.js";
import type { IActivityUpdateRepository } from "../../ports/activities.js";
import type { IEvidenceRepository } from "../../ports/evidence.js";
import type { IDonorTemplateRepository } from "../../ports/templates.js";
import type { IOrganizationRepository } from "../../ports/identity.js";
import type { IIdGenerator, IAuditLogger } from "../../ports/core.js";

export class GenerateReportDraftHandler {
  constructor(
    private readonly ids: IIdGenerator,
    private readonly periods: IReportingPeriodRepository,
    private readonly drafts: IReportDraftRepository,
    private readonly sections: IReportSectionRepository,
    private readonly projects: IProjectRepository,
    private readonly organizations: IOrganizationRepository,
    private readonly templates: IDonorTemplateRepository,
    private readonly logframe: ILogframeRepository,
    private readonly indicators: IIndicatorRepository,
    private readonly indicatorUpdates: IIndicatorUpdateRepository,
    private readonly activities: IActivityUpdateRepository,
    private readonly evidence: IEvidenceRepository,
    private readonly generator: IReportDraftGenerator,
    private readonly audit: IAuditLogger,
  ) {}

  async handle(ctx: AuthenticatedContext, reportingPeriodId: string): Promise<Result<{ draftId: string; sectionIds: string[] }, DomainError>> {
    const periodResult = await this.periods.findById(reportingPeriodId, ctx.tenant.tenantId);
    if (!periodResult.ok) return periodResult;
    if (!periodResult.value) return { ok: false, error: DomainError.notFound("ReportingPeriod", reportingPeriodId) };
    const period = periodResult.value;

    const projectResult = await this.projects.findById(period.projectId, ctx.tenant.tenantId);
    if (!projectResult.ok) return projectResult;
    if (!projectResult.value) return { ok: false, error: DomainError.notFound("Project", period.projectId) };
    const project = projectResult.value;
    const organizationResult = await this.organizations.findByTenant(ctx.tenant.tenantId);
    if (!organizationResult.ok) return organizationResult;
    if (!organizationResult.value) return { ok: false, error: DomainError.notFound("Organization", ctx.tenant.tenantId.toString()) };
    const aiEnabled = organizationResult.value.aiEnabled;

    const template = period.donorTemplateId
      ? await this.templates.findById(period.donorTemplateId, ctx.tenant.tenantId)
      : undefined;
    const templateSections = template?.ok && template.value ? template.value.sections : [];
    const requiredAnnexes = template?.ok && template.value ? template.value.requiredAnnexes : [];

    const logframeResult = await this.logframe.findByProject(period.projectId, ctx.tenant.tenantId);
    const indicatorResult = await this.indicators.findByProject(period.projectId, ctx.tenant.tenantId);
    const indicatorUpdatesResult = await this.indicatorUpdates.findByReportingPeriod(reportingPeriodId, ctx.tenant.tenantId);
    const activitiesResult = await this.activities.findByReportingPeriod(reportingPeriodId, ctx.tenant.tenantId);
    if (!logframeResult.ok) return logframeResult;
    if (!indicatorResult.ok) return indicatorResult;
    if (!indicatorUpdatesResult.ok) return indicatorUpdatesResult;
    if (!activitiesResult.ok) return activitiesResult;

    const logframeSummary = logframeResult.value
      .map((i) => `[${i.level}${i.code ? ` ${i.code}` : ""}] ${i.title}`)
      .join("; ");

    const indicatorSummary = indicatorResult.value.map((ind) => {
      const upd = indicatorUpdatesResult.value.find((u) => u.indicatorId === ind.id);
      return {
        code: ind.code,
        name: ind.name,
        baseline: ind.baseline,
        target: ind.target,
        periodAchievement: upd?.periodAchievement ?? "0",
        cumulativeAchievement: upd?.cumulativeAchievement ?? "0",
        unit: ind.unit,
      };
    });

    const activitiesArr = activitiesResult.value.map((a) => ({
      id: a.id,
      title: a.activityTitle,
      location: a.location,
      date: a.activityDate.toISOString(),
      participants: a.participantsTotal ?? 0,
      summary: a.summary,
      achievements: a.achievements,
      challenges: a.challenges,
      lessonsLearned: a.lessonsLearned,
    }));

    const evidenceByActivity = new Map<string, Array<{ id: string; title: string; type: string }>>();
    const evidenceByIndicator = new Map<string, Array<{ id: string; title: string; type: string }>>();
    for (const a of activitiesResult.value) {
      const evList: Array<{ id: string; title: string; type: string }> = [];
      for (const evId of a.attachedEvidenceIds) {
        const ev = await this.evidence.findById(evId, ctx.tenant.tenantId);
        if (ev.ok && ev.value) evList.push({ id: ev.value.id, title: ev.value.title, type: ev.value.evidenceType });
      }
      evidenceByActivity.set(a.id, evList);
    }
    for (const u of indicatorUpdatesResult.value) {
      const evList: Array<{ id: string; title: string; type: string }> = [];
      for (const evId of u.attachedEvidenceIds) {
        const ev = await this.evidence.findById(evId, ctx.tenant.tenantId);
        if (ev.ok && ev.value) evList.push({ id: ev.value.id, title: ev.value.title, type: ev.value.evidenceType });
      }
      evidenceByIndicator.set(u.indicatorId, evList);
    }

    const checklistSummary: Array<{ title: string; severity: string; status: string }> = [];

    const draftId = this.ids.generate();
    const draft = ReportDraft.create({
      id: draftId,
      tenantId: ctx.tenant.tenantId.toString(),
      projectId: period.projectId,
      reportingPeriodId,
      title: `${project.title} — ${period.reportType.toLowerCase()} report`,
      generatedByAi: aiEnabled,
      createdById: ctx.tenant.userId,
    });
    const savedDraft = await this.drafts.create(draft);
    if (!savedDraft.ok) return savedDraft;

    const generationInput = {
      reportingPeriodId,
      projectName: project.title,
      donorName: project.donorName,
      reportType: period.reportType,
      templateSections: templateSections.map((s) => ({
        id: s.id,
        title: s.title,
        description: s.description,
        inputType: s.inputType,
        required: s.required,
        evidenceNeeded: s.evidenceNeeded,
      })),
      logframeSummary,
      indicatorSummary,
      activities: activitiesArr,
      evidenceByActivity,
      evidenceByIndicator,
      checklistSummary,
    };
    const generated = aiEnabled
      ? await this.generator.generateDraft(generationInput)
      : this.buildManualSections(generationInput.templateSections);

    const sectionIds: string[] = [];
    for (let i = 0; i < generated.length; i++) {
      const g = generated[i]!;
      const sectionId = this.ids.generate();
      sectionIds.push(sectionId);
      const section = ReportSection.create({
        id: sectionId,
        tenantId: ctx.tenant.tenantId.toString(),
        reportDraftId: draftId,
        sectionTitle: g.title,
        sectionOrder: i,
        content: g.content,
        sourceReferences: g.sourceReferences,
        unsupportedClaims: g.unsupportedClaims,
        status: "DRAFTED",
      });
      const savedSection = await this.sections.create(section);
      if (!savedSection.ok) return savedSection;
    }

    period.transitionTo(period.status);
    period.setDonorTemplate(period.donorTemplateId ?? "");
    const updatedPeriod = await this.periods.update(period);

    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "report.draft.generated",
      entityType: "report_draft",
      entityId: draftId,
      projectId: period.projectId,
      newValue: `sections=${sectionIds.length};generatedByAi=${aiEnabled}`,
    });

    return { ok: true, value: { draftId, sectionIds } };
  }

  private buildManualSections(templateSections: Array<{ id: string; title: string }>): Array<{
    sectionId: string;
    title: string;
    content: string;
    sourceReferences: [];
    unsupportedClaims: [];
  }> {
    const sections = templateSections.length > 0
      ? templateSections
      : [{ id: "manual-narrative", title: "Narrative Report" }];
    return sections.map((section) => ({
      sectionId: section.id,
      title: section.title,
      content: "",
      sourceReferences: [],
      unsupportedClaims: [],
    }));
  }
}
