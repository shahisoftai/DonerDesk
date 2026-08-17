import type { Result } from "@donordesk/domain";
import { DomainError, ExportPackage, type ChartConfig } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IExportRepository, IExportBuilder } from "../../ports/exports.js";
import type { IStorage } from "../../ports/infrastructure.js";
import type { IIdGenerator, IAuditLogger } from "../../ports/core.js";
import type { IReportingPeriodRepository, IReportDraftRepository, IReportSectionRepository } from "../../ports/reporting.js";
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
    private readonly builder: IExportBuilder,
    private readonly storage: IStorage,
    private readonly audit: IAuditLogger,
  ) {}

  async handle(ctx: AuthenticatedContext, input: CreateExportInput): Promise<Result<{ id: string; fileUrl: string }, DomainError>> {
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

    const charts = sectionChartConfigs
      .filter((c): c is { title: string; chartConfig: ChartConfig } => c.chartConfig !== null)
      .map((c) => ({
        sectionTitle: c.title,
        config: c.chartConfig,
        indicators: indicatorRows,
      }));

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

    const artifacts = await this.builder.build({
      exportType: input.exportType,
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
