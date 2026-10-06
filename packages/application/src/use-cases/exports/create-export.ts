import type { Result } from "@donordesk/domain";
import { DomainError, ExportPackage, bindingsForSection, chartAchievement, indicatorExportRow, omitExcludedStatements, type ChartConfig, type ExportIndicatorRow } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IExportRepository, IExportBuilder, ExportIntent, ExportChartInput } from "../../ports/exports.js";
import type { IStorage } from "../../ports/infrastructure.js";
import type { IIdGenerator, IAuditLogger } from "../../ports/core.js";
import type { IReportingPeriodRepository, IReportDraftRepository, IReportSectionRepository, ISubmissionSnapshotRepository, IDonorTemplateMappingRepository, IReportClaimRepository, IReportArtifactRepository } from "../../ports/reporting.js";
import { chartPayloadToResolved } from "../../services/section-chart-service.js";
import type { IDonorTemplateRepository } from "../../ports/templates.js";
import type { IProjectRepository } from "../../ports/projects.js";
import type { IIndicatorRepository, IIndicatorUpdateRepository } from "../../ports/logframe.js";
import type { IActivityUpdateRepository } from "../../ports/activities.js";
import type { IChecklistRepository } from "../../ports/compliance.js";
import type { IEvidenceRepository } from "../../ports/evidence.js";
import type { CreateExportInput } from "@donordesk/contracts";
import { resolvePeriodActivities } from "../../services/period-activities.js";
import { PeriodEvidenceScope } from "../../services/period-evidence-scope-service.js";
import { exportFileName } from "../../services/export-file-name.js";

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
    private readonly claims?: IReportClaimRepository,
    /** The charts drawn from each section's tables; absent: only hand-configured charts are exported. */
    private readonly reportArtifacts?: IReportArtifactRepository,
  ) {}

  async handle(ctx: AuthenticatedContext, input: CreateExportInput): Promise<Result<{ id: string; fileUrl: string; fileName: string }, DomainError>> {
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

    let sectionsArr: Array<{ title: string; content: string; status: string; level: number }> = [];
    let sectionChartConfigs: Array<{ title: string; chartConfig: ChartConfig | null }> = [];
    // The charts drawn from each section's own tables: the same ones the editor shows, so the file matches the screen.
    const tableCharts: ExportChartInput[] = [];
    if (draft) {
      const s = await this.sections.findByReportDraft(draft.id, ctx.tenant.tenantId);
      if (s.ok) {
        const sorted = [...s.value].sort((a, b) => a.sectionOrder - b.sectionOrder);
        // Statements the reviewer chose to leave out never reach the donor.
        const claimsResult = this.claims ? await this.claims.findByDraft(draft.id, ctx.tenant.tenantId) : undefined;
        const claims = claimsResult?.ok ? claimsResult.value : [];
        sectionsArr = sorted.map((sec) => ({
          title: sec.sectionTitle,
          content: omitExcludedStatements(sec.content, claims.filter((c) => c.sectionId === sec.id)),
          status: sec.status,
          level: sec.level,
        }));
        sectionChartConfigs = sorted.map((sec) => ({ title: sec.sectionTitle, chartConfig: sec.chartConfig }));
        if (this.reportArtifacts) {
          for (const sec of sorted) {
            const stored = await this.reportArtifacts.findBySection(sec.id, ctx.tenant.tenantId);
            if (!stored.ok) continue;
            for (const a of stored.value.filter((x) => x.kind === "CHART")) {
              const resolved = chartPayloadToResolved(a.payload);
              if (resolved) tableCharts.push({ sectionTitle: sec.sectionTitle, caption: a.caption ?? resolved.title, resolved });
            }
          }
        }
      }
    }

    const inds = await this.indicators.findByProject(input.projectId, ctx.tenant.tenantId);
    const ups = await this.updates.findByReportingPeriod(input.reportingPeriodId, ctx.tenant.tenantId);
    const indicatorRows: ExportIndicatorRow[] = [];
    if (inds.ok && ups.ok) {
      for (const ind of inds.value) {
        const u = ups.value.find((x) => x.indicatorId === ind.id);
        indicatorRows.push(indicatorExportRow({ reportType: period.value.reportType, indicator: ind, update: u }));
      }
    }

    // Hand-configured charts plot the report's own indicators: the cumulative figure for a roll-up report, only indicators
    // that have a value (a missing one is not "0"), never the whole project's.
    const reportType = period.value.reportType;
    const chartRows = (inds.ok && ups.ok ? inds.value : [])
      .map((ind) => {
        const u = ups.ok ? ups.value.find((x) => x.indicatorId === ind.id) : undefined;
        return u
          ? { code: ind.code, name: ind.name, baseline: ind.baseline, target: ind.target, unit: ind.unit, achievement: chartAchievement({ reportType, indicatorType: ind.type, periodValue: u.periodAchievement, cumulativeValue: u.cumulativeAchievement }), status: u.verificationStatus }
          : undefined;
      })
      .filter((r): r is NonNullable<typeof r> => r !== undefined);
    const manualCharts: ExportChartInput[] = sectionChartConfigs
      .filter((c): c is { title: string; chartConfig: ChartConfig } => c.chartConfig !== null)
      // A hand-made indicator chart that does not belong in its section (a financial one) is not shipped, as it is not shown.
      .filter((c) => bindingsForSection(c.title).includes(c.chartConfig.dataBinding))
      .map((c) => ({ sectionTitle: c.title, config: c.chartConfig, indicators: chartRows }));
    const charts: ExportChartInput[] = [...tableCharts, ...manualCharts];

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

    // The evidence a report covers is decided in one place (a roll-up report covers the project's), so the pack
    // lists what the wizard offered and what generation used.
    const periodActivities = await resolvePeriodActivities(this.activities, period.value, ctx.tenant.tenantId);
    const ev = periodActivities.ok
      ? await new PeriodEvidenceScope(this.evidence).filesFor(ctx.tenant.tenantId, period.value, periodActivities.value.map((a) => a.id))
      : periodActivities;
    const evidenceRows: Array<{ id: string; fileName: string; title: string; type: string; verificationStatus: string; confidentiality: string }> = [];
    const includeIds = new Set(input.includeEvidenceIds);
    if (ev.ok) {
      for (const e of ev.value) {
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

    const fileName = exportFileName({
      projectTitle: project.value.title,
      reportType: period.value.reportType,
      periodStart: period.value.duration.start,
      periodEnd: period.value.duration.end,
      version: draft?.version,
      exportType: input.exportType,
      intent,
    });
    return { ok: true, value: { id, fileUrl: stored.url, fileName } };
  }
}
