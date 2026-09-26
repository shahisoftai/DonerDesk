import type { Result } from "@donordesk/domain";
import { DomainError, ExportPackage, createChartConfig, type ChartConfig } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IExportRepository, IExportBuilder, ExportIntent } from "../../ports/exports.js";
import type { IStorage } from "../../ports/infrastructure.js";
import type { IIdGenerator, IAuditLogger } from "../../ports/core.js";
import type { IReportingPeriodRepository, IReportDraftRepository, IReportSectionRepository, ISubmissionSnapshotRepository, IDonorTemplateMappingRepository } from "../../ports/reporting.js";
import type { IDonorTemplateRepository } from "../../ports/templates.js";
import type { IProjectRepository } from "../../ports/projects.js";
import type { IIndicatorRepository, IIndicatorUpdateRepository } from "../../ports/logframe.js";
import type { IActivityUpdateRepository } from "../../ports/activities.js";
import type { IChecklistRepository } from "../../ports/compliance.js";
import type { IEvidenceRepository } from "../../ports/evidence.js";
import type { CreateExportInput } from "@donordesk/contracts";

export class CreateExportHandler {
  constructor(
    private readonly ids: IIdGenerator,
    private readonly exports: IExportRepository,
    private readonly projects: IProjectRepository,
    private readonly periods: IReportingPeriodRepository,
    private readonly drafts: IReportDraftRepository,
    private readonly sections: IReportSectionRepository,
    private readonly indicators: IIndicatorRepository,
    private readonly updates: IIndicatorUpdateRepository,
    private readonly activities: IActivityUpdateRepository,
    private readonly checklist: IChecklistRepository,
    private readonly evidence: IEvidenceRepository,
    private readonly snapshots: ISubmissionSnapshotRepository,
    private readonly builder: IExportBuilder,
    private readonly storage: IStorage,
    private readonly audit: IAuditLogger,
    private readonly donorTemplateMappings?: IDonorTemplateMappingRepository,
    private readonly donorTemplates?: IDonorTemplateRepository,
  ) {}

  async handle(ctx: AuthenticatedContext, input: CreateExportInput): Promise<Result<{ id: string; fileUrl: string }, DomainError>> {
    const intent: ExportIntent = input.exportIntent ?? "INTERNAL_REVIEW";
    if (intent === "DONOR_SUBMISSION" && !input.submissionSnapshotId) {
      return {
        ok: false,
        error: DomainError.reportGateBlocked("Donor submission exports require a submission snapshot id"),
      };
    }
    if (intent === "DONOR_SUBMISSION" && input.submissionSnapshotId) {
      const snapshotResult = await this.snapshots.findById(input.submissionSnapshotId, ctx.tenant.tenantId);
      if (!snapshotResult.ok) return snapshotResult;
      if (!snapshotResult.value) {
        return { ok: false, error: DomainError.notFound("SubmissionSnapshot", input.submissionSnapshotId) };
      }
      if (snapshotResult.value.status !== "SEALED") {
        return { ok: false, error: DomainError.reportGateBlocked("Submission snapshot is not sealed") };
      }
      if (snapshotResult.value.reportingPeriodId !== input.reportingPeriodId) {
        return { ok: false, error: DomainError.reportGateBlocked("Submission snapshot does not match this reporting period") };
      }
    }

    const project = await this.projects.findById(input.projectId, ctx.tenant.tenantId);
    if (!project.ok) return project;
    if (!project.value) return { ok: false, error: DomainError.notFound("Project", input.projectId) };

    const period = await this.periods.findById(input.reportingPeriodId, ctx.tenant.tenantId);
    if (!period.ok) return period;
    if (!period.value) return { ok: false, error: DomainError.notFound("ReportingPeriod", input.reportingPeriodId) };

    const drafts = await this.drafts.findByReportingPeriod(input.reportingPeriodId, ctx.tenant.tenantId);
    if (!drafts.ok) return drafts;
    const draft = drafts.value[0];

    let sectionsArr: Array<{ title: string; content: string; status: string }> = [];
    let sectionChartConfigs: Array<{ title: string; chartConfig: ChartConfig | null }> = [];
    if (draft) {
      const s = await this.sections.findByReportDraft(draft.id, ctx.tenant.tenantId);
      if (s.ok) {
        const sorted = [...s.value].sort((a, b) => a.sectionOrder - b.sectionOrder);
        sectionsArr = sorted.map((sec) => ({ title: sec.sectionTitle, content: sec.content, status: sec.status }));
        sectionChartConfigs = sorted.map((sec) => ({ title: sec.sectionTitle, chartConfig: sec.chartConfig }));
      }
    }

    const inds = await this.indicators.findByProject(input.projectId, ctx.tenant.tenantId);
    const ups = await this.updates.findByReportingPeriod(input.reportingPeriodId, ctx.tenant.tenantId);
    const indicatorRows: Array<{ code: string; name: string; baseline: string; target: string; achievement: string; unit?: string; status: string }> = [];
    if (inds.ok && ups.ok) {
      for (const ind of inds.value) {
        const u = ups.value.find((x) => x.indicatorId === ind.id);
        indicatorRows.push({
          code: ind.code,
          name: ind.name,
          baseline: ind.baseline,
          target: ind.target,
          achievement: u?.periodAchievement ?? "0",
          unit: ind.unit,
          status: u?.verificationStatus ?? "DRAFT",
        });
      }
    }

    let charts = sectionChartConfigs
      .filter((c): c is { title: string; chartConfig: ChartConfig } => c.chartConfig !== null)
      .map((c) => ({
        sectionTitle: c.title,
        config: c.chartConfig,
        indicators: indicatorRows,
      }));

    // Default chart: a report with numeric indicators but no user-configured
    // section chart still ships with a comparison visual (the EERP Q2 export
    // carried zero charts while the rendering pipeline existed unused).
    if (charts.length === 0 && indicatorRows.length >= 2 && sectionsArr.length > 0) {
      const chartSection =
        sectionsArr.find((s) => /indicator|progress/i.test(s.title)) ?? sectionsArr[0];
      if (chartSection) {
        charts = [
          {
            sectionTitle: chartSection.title,
            config: createChartConfig({ type: "BAR", dataBinding: "INDICATOR_COMPARISON" }),
            indicators: indicatorRows,
          },
        ];
      }
    }

    const acts = await this.activities.findByReportingPeriod(input.reportingPeriodId, ctx.tenant.tenantId);
    const activityRows: Array<{ title: string; date: string; location?: string; participants: number }> = [];
    if (acts.ok) {
      for (const a of acts.value) {
        activityRows.push({
          title: a.activityTitle,
          date: a.activityDate.toISOString(),
          location: a.location,
          participants: a.participantsTotal ?? 0,
        });
      }
    }

    const cl = await this.checklist.findByReportingPeriod(input.reportingPeriodId, ctx.tenant.tenantId);
    const checklistRows: Array<{ title: string; severity: string; status: string; resolutionNotes?: string }> = [];
    if (cl.ok) {
      for (const i of cl.value) {
        checklistRows.push({
          title: i.title,
          severity: i.severity,
          status: i.status,
          resolutionNotes: i.resolutionNotes,
        });
      }
    }

    const ev = await this.evidence.search({ reportingPeriodId: input.reportingPeriodId, pageSize: 500 }, ctx.tenant.tenantId);
    const evidenceRows: Array<{ id: string; fileName: string; title: string; type: string; verificationStatus: string; confidentiality: string }> = [];
    const includeIds = new Set(input.includeEvidenceIds);
    if (ev.ok) {
      for (const e of ev.value.items) {
        if (e.confidentialityLevel === "HIGHLY_SENSITIVE" && !input.includeSensitive) continue;
        if (e.confidentialityLevel === "SENSITIVE" && !input.includeSensitive && !includeIds.has(e.id)) continue;
        evidenceRows.push({
          id: e.id,
          fileName: e.fileName,
          title: e.title,
          type: e.evidenceType,
          verificationStatus: e.verificationStatus,
          confidentiality: e.confidentialityLevel,
        });
      }
    }

    // Donor-template rendering (docxtpl): only populated when the period
    // has an APPROVED, locked mapping — every other tenant/period gets
    // `undefined` here, which `buildDonorTemplate()` treats identically to
    // the feature not existing at all. Resolution failure at any step
    // (missing optional deps, no mapping, mapping not approved, template
    // not found) simply leaves this undefined rather than failing the
    // export — the generic fallback always still works.
    let donorTemplate: Parameters<IExportBuilder["build"]>[0]["donorTemplate"];
    if (input.exportType === "DONOR_TEMPLATE" && this.donorTemplateMappings && this.donorTemplates && period.value.donorTemplateMappingId) {
      const mappingResult = await this.donorTemplateMappings.findById(period.value.donorTemplateMappingId, ctx.tenant.tenantId);
      const mapping = mappingResult.ok ? mappingResult.value : null;
      if (mapping?.approvedAt && mapping.templatedFileUrl) {
        const templateResult = period.value.donorTemplateId
          ? await this.donorTemplates.findById(period.value.donorTemplateId, ctx.tenant.tenantId)
          : { ok: true as const, value: null };
        const templateSections = templateResult.ok ? templateResult.value?.sections ?? [] : [];
        const titleById = new Map(templateSections.map((s) => [s.id, s.title]));
        const placeholderSections = mapping.regionsList
          .map((r) => {
            const sectionTitle = titleById.get(r.templateSectionId);
            return sectionTitle ? { placeholderKey: r.placeholderKey, sectionTitle } : undefined;
          })
          .filter((r): r is { placeholderKey: string; sectionTitle: string } => r !== undefined);
        if (placeholderSections.length > 0) {
          donorTemplate = { templatedFileKey: mapping.templatedFileUrl, placeholderSections };
        }
      }
    }

    const artifacts = await this.builder.build({
      exportType: input.exportType,
      exportIntent: intent,
      submissionSnapshotId: input.submissionSnapshotId,
      projectName: project.value.title,
      reportingPeriodLabel: `${period.value.duration.start.toISOString().slice(0, 10)} → ${period.value.duration.end.toISOString().slice(0, 10)}`,
      reportTitle: draft?.title ?? `${project.value.title} report`,
      sections: sectionsArr,
      indicators: indicatorRows,
      charts,
      activities: activityRows,
      checklist: checklistRows,
      evidenceItems: evidenceRows,
      includeSensitive: input.includeSensitive,
      watermark: intent === "DONOR_SUBMISSION" ? undefined : "INTERNAL PREVIEW",
      donorTemplate,
    });

    const id = this.ids.generate();
    const ext = artifacts.fileName.split(".").pop() ?? "bin";
    const storageKey = `${ctx.tenant.tenantId.toString()}/exports/${id}.${ext}`;
    const stored = await this.storage.put({
      key: storageKey,
      body: artifacts.fileBuffer,
      contentType: artifacts.contentType,
    });

    const exp = ExportPackage.create({
      id,
      tenantId: ctx.tenant.tenantId.toString(),
      projectId: input.projectId,
      reportingPeriodId: input.reportingPeriodId,
      exportType: input.exportType,
      exportIntent: intent,
      submissionSnapshotId: input.submissionSnapshotId,
      fileUrl: stored.url,
      version: draft?.version ?? 1,
      exportedById: ctx.tenant.userId,
      includedFiles: evidenceRows.map((e) => e.id),
    });
    const saved = await this.exports.create(exp);
    if (!saved.ok) return saved;

    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "export.completed",
      entityType: "export_package",
      entityId: id,
      projectId: input.projectId,
      newValue: input.exportType,
    });

    return { ok: true, value: { id, fileUrl: stored.url } };
  }
}
