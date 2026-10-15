import type { Result, DataChartSpec } from "@donordesk/domain";
import { DomainError, buildDataChart } from "@donordesk/domain";
import type { AddSectionDataChartInput, UpdateSectionDataChartInput } from "@donordesk/contracts";
import type { AuthenticatedContext } from "../../context.js";
import type { GeneratedArtifact, GeneratedChartSpec, IReportArtifactRepository, IReportDraftRepository, IReportSectionRepository, IReportingPeriodRepository, ReportArtifactRecord } from "../../ports/reporting.js";
import type { IAuditLogger, IIdGenerator } from "../../ports/core.js";
import type { GetProjectDataSheetHandler } from "../data-center/data-sheet.js";
import { isDataCenterChart } from "../../services/section-chart-service.js";

/** A Data Center chart of a section as the editor lists it, with whether its data has moved since it was drawn. */
export interface SectionDataChartView {
  id: string;
  caption: string;
  title: string;
  spec: DataChartSpec;
  builtAt: string;
  points: number;
  unverified: number;
  notes: string[];
  /** The data sheet now gives a different picture than the one stored (values, periods or finance changed). */
  stale: boolean;
  /** The chart can no longer be drawn from the current data (an indicator was archived, every value removed). */
  broken?: string;
}

type SectionContext = { sectionId: string; projectId: string; reopened: boolean };

const sameDrawing = (a: GeneratedChartSpec, b: { categories: string[]; series: Array<{ name: string; data: Array<string | number | null> }>; unit?: string | undefined }): boolean =>
  JSON.stringify({ c: a.categories, s: a.series.map((x) => [x.name, x.data]), u: a.unit ?? "" }) === JSON.stringify({ c: b.categories, s: b.series.map((x) => [x.name, x.data]), u: b.unit ?? "" });

/**
 * Charts a person adds to a report section from the Data Center. Each is a stored CHART artifact that carries the settings it was
 * drawn from and the data it showed (so an approved report never changes by itself); "Update" redraws it from the settings.
 * Changing one is an edit of the section: the draft must still be a draft, and an approved section is reopened, as a text edit does.
 */
export class SectionDataChartsHandler {
  constructor(
    private readonly sections: IReportSectionRepository,
    private readonly drafts: IReportDraftRepository,
    private readonly periods: IReportingPeriodRepository,
    private readonly artifacts: IReportArtifactRepository,
    private readonly dataSheet: GetProjectDataSheetHandler,
    private readonly ids: IIdGenerator,
    private readonly audit: IAuditLogger,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async list(ctx: AuthenticatedContext, sectionId: string): Promise<Result<SectionDataChartView[], DomainError>> {
    const located = await this.locate(ctx, sectionId, false);
    if (!located.ok) return located;
    const stored = await this.artifacts.findBySection(sectionId, ctx.tenant.tenantId);
    if (!stored.ok) return stored;
    const mine = stored.value.filter((a) => a.kind === "CHART" && isDataCenterChart(a.payload));
    if (mine.length === 0) return { ok: true, value: [] };
    const sheet = await this.dataSheet.handle(ctx, located.value.projectId);
    if (!sheet.ok) return sheet;
    return {
      ok: true,
      value: mine.map((a) => {
        const p = a.payload as GeneratedChartSpec;
        const dc = p.dataCenter!;
        const fresh = buildDataChart(sheet.value, dc.spec);
        const view: SectionDataChartView = {
          id: dc.id,
          caption: a.caption ?? p.caption,
          title: p.title,
          spec: dc.spec,
          builtAt: dc.builtAt,
          points: dc.points,
          unverified: dc.unverified,
          notes: dc.notes,
          stale: fresh.ok ? !sameDrawing(p, fresh.resolved) : false,
        };
        return fresh.ok ? view : { ...view, stale: true, broken: fresh.reason };
      }),
    };
  }

  async add(ctx: AuthenticatedContext, sectionId: string, input: AddSectionDataChartInput): Promise<Result<{ id: string }, DomainError>> {
    const located = await this.locate(ctx, sectionId, true);
    if (!located.ok) return located;
    const drawn = await this.draw(ctx, located.value.projectId, input.spec as DataChartSpec);
    if (!drawn.ok) return drawn;
    const id = this.ids.generate();
    const all = await this.records(ctx, sectionId);
    if (!all.ok) return all;
    const artifact = this.toArtifact(id, input.spec as DataChartSpec, drawn.value, input.caption, all.value.length);
    const saved = await this.save(ctx, sectionId, [...all.value.map(keep), artifact]);
    if (!saved.ok) return saved;
    await this.record(ctx, sectionId, "report.section.data_chart.added", id, located.value.reopened);
    return { ok: true, value: { id } };
  }

  async update(ctx: AuthenticatedContext, sectionId: string, chartId: string, input: UpdateSectionDataChartInput): Promise<Result<{ id: string }, DomainError>> {
    return this.rewrite(ctx, sectionId, chartId, "report.section.data_chart.updated", async (current, projectId) => {
      const spec = (input.spec as DataChartSpec | undefined) ?? current.spec;
      const drawn = await this.draw(ctx, projectId, spec);
      if (!drawn.ok) return drawn;
      return { ok: true, value: this.toArtifact(chartId, spec, drawn.value, input.caption ?? current.caption, current.ordinal) };
    });
  }

  /** Redraws the chart from its saved settings and the data as it is now ("Update"). */
  async refresh(ctx: AuthenticatedContext, sectionId: string, chartId: string): Promise<Result<{ id: string }, DomainError>> {
    return this.rewrite(ctx, sectionId, chartId, "report.section.data_chart.refreshed", async (current, projectId) => {
      const drawn = await this.draw(ctx, projectId, current.spec);
      if (!drawn.ok) return drawn;
      return { ok: true, value: this.toArtifact(chartId, current.spec, drawn.value, current.caption, current.ordinal) };
    });
  }

  async remove(ctx: AuthenticatedContext, sectionId: string, chartId: string): Promise<Result<{ removed: true }, DomainError>> {
    const located = await this.locate(ctx, sectionId, true);
    if (!located.ok) return located;
    const all = await this.records(ctx, sectionId);
    if (!all.ok) return all;
    if (!all.value.some((a) => chartIdOf(a) === chartId)) return { ok: false, error: DomainError.notFound("Chart", chartId) };
    const saved = await this.save(ctx, sectionId, all.value.filter((a) => chartIdOf(a) !== chartId).map(keep));
    if (!saved.ok) return saved;
    await this.record(ctx, sectionId, "report.section.data_chart.removed", chartId, located.value.reopened);
    return { ok: true, value: { removed: true } };
  }

  /** Moves a chart one place among the section's Data Center charts. */
  async move(ctx: AuthenticatedContext, sectionId: string, chartId: string, direction: "UP" | "DOWN"): Promise<Result<{ moved: boolean }, DomainError>> {
    const located = await this.locate(ctx, sectionId, true);
    if (!located.ok) return located;
    const all = await this.records(ctx, sectionId);
    if (!all.ok) return all;
    const mine = all.value.filter((a) => isDataCenterChart(a.payload));
    const at = mine.findIndex((a) => chartIdOf(a) === chartId);
    if (at < 0) return { ok: false, error: DomainError.notFound("Chart", chartId) };
    const to = direction === "UP" ? at - 1 : at + 1;
    if (to < 0 || to >= mine.length) return { ok: true, value: { moved: false } };
    const reordered = [...mine];
    [reordered[at], reordered[to]] = [reordered[to]!, reordered[at]!];
    const others = all.value.filter((a) => !isDataCenterChart(a.payload));
    const saved = await this.save(ctx, sectionId, [...others, ...reordered].map(keep));
    if (!saved.ok) return saved;
    await this.record(ctx, sectionId, "report.section.data_chart.moved", chartId, located.value.reopened);
    return { ok: true, value: { moved: true } };
  }

  // -------------------------------------------------------------------------

  private async rewrite(
    ctx: AuthenticatedContext,
    sectionId: string,
    chartId: string,
    event: string,
    build: (current: { spec: DataChartSpec; caption: string; ordinal: number }, projectId: string) => Promise<Result<GeneratedArtifact, DomainError>>,
  ): Promise<Result<{ id: string }, DomainError>> {
    const located = await this.locate(ctx, sectionId, true);
    if (!located.ok) return located;
    const all = await this.records(ctx, sectionId);
    if (!all.ok) return all;
    const found = all.value.find((a) => chartIdOf(a) === chartId);
    if (!found) return { ok: false, error: DomainError.notFound("Chart", chartId) };
    const payload = found.payload as GeneratedChartSpec;
    const built = await build({ spec: payload.dataCenter!.spec, caption: found.caption ?? payload.caption, ordinal: found.ordinal }, located.value.projectId);
    if (!built.ok) return built;
    const saved = await this.save(ctx, sectionId, all.value.map((a) => (a === found ? built.value : keep(a))));
    if (!saved.ok) return saved;
    await this.record(ctx, sectionId, event, chartId, located.value.reopened);
    return { ok: true, value: { id: chartId } };
  }

  /** The section, its report's project, and (for a change) the draft/approval rules a text edit follows. */
  private async locate(ctx: AuthenticatedContext, sectionId: string, forChange: boolean): Promise<Result<SectionContext, DomainError>> {
    const found = await this.sections.findById(sectionId, ctx.tenant.tenantId);
    if (!found.ok) return found;
    if (!found.value) return { ok: false, error: DomainError.notFound("ReportSection", sectionId) };
    const section = found.value;
    const draft = await this.drafts.findById(section.reportDraftId, ctx.tenant.tenantId);
    if (!draft.ok) return draft;
    if (!draft.value) return { ok: false, error: DomainError.notFound("ReportDraft", section.reportDraftId) };
    const period = await this.periods.findById(draft.value.reportingPeriodId, ctx.tenant.tenantId);
    if (!period.ok) return period;
    if (!period.value) return { ok: false, error: DomainError.notFound("ReportingPeriod", draft.value.reportingPeriodId) };
    let reopened = false;
    if (forChange) {
      if (draft.value.isSuperseded || draft.value.status !== "DRAFT") {
        return { ok: false, error: DomainError.invalidTransition(draft.value.isSuperseded ? "This is an older version of the report and can no longer be edited." : "This report is no longer a draft, so its charts cannot be changed.") };
      }
      if (section.status === "APPROVED") {
        section.resetToDraft();
        const saved = await this.sections.update(section);
        if (!saved.ok) return saved;
        reopened = true;
      }
    }
    return { ok: true, value: { sectionId, projectId: period.value.projectId, reopened } };
  }

  private async draw(ctx: AuthenticatedContext, projectId: string, spec: DataChartSpec) {
    const sheet = await this.dataSheet.handle(ctx, projectId);
    if (!sheet.ok) return sheet;
    const known = new Set(sheet.value.indicators.map((i) => i.id));
    const missing = spec.indicatorIds.filter((id) => !known.has(id));
    if (missing.length > 0) return { ok: false as const, error: DomainError.validation("One of the chosen indicators is not part of this project (or was retired).") };
    for (const id of [spec.fromPeriodId, spec.toPeriodId]) {
      if (id && !sheet.value.periods.some((p) => p.id === id)) return { ok: false as const, error: DomainError.validation("The chosen period is not part of this project.") };
    }
    const drawn = buildDataChart(sheet.value, spec);
    if (!drawn.ok) return { ok: false as const, error: DomainError.validation(drawn.reason) };
    return { ok: true as const, value: drawn };
  }

  private toArtifact(id: string, spec: DataChartSpec, drawn: Extract<ReturnType<typeof buildDataChart>, { ok: true }>, caption: string | undefined, ordinal: number): GeneratedArtifact {
    const r = drawn.resolved;
    const text = (caption ?? "").trim() || drawn.title;
    return {
      kind: "CHART",
      caption: text,
      ordinal,
      payload: {
        type: r.type,
        dataBinding: "DATA_CENTER",
        ...(r.unit ? { unit: r.unit } : {}),
        title: drawn.title,
        caption: text,
        categories: r.categories,
        series: r.series.map((s) => ({ name: s.name, data: s.data, sourceReferences: [] })),
        sourceReferences: [],
        ...(r.stacked ? { stacked: true } : {}),
        ...(r.referenceLine ? { referenceLine: r.referenceLine } : {}),
        dataCenter: { id, spec, builtAt: this.now().toISOString(), points: drawn.provenance.points, unverified: drawn.provenance.unverified, notes: drawn.notes },
      },
      sourceReferences: [],
    };
  }

  private async records(ctx: AuthenticatedContext, sectionId: string): Promise<Result<ReportArtifactRecord[], DomainError>> {
    const stored = await this.artifacts.findBySection(sectionId, ctx.tenant.tenantId);
    if (!stored.ok) return stored;
    return { ok: true, value: [...stored.value].sort((a, b) => a.ordinal - b.ordinal) };
  }

  private async save(ctx: AuthenticatedContext, sectionId: string, artifacts: GeneratedArtifact[]): Promise<Result<void, DomainError>> {
    return this.artifacts.replaceForSection({
      tenantId: ctx.tenant.tenantId,
      sectionId,
      revisionId: null,
      artifacts: artifacts.map((a, i) => ({ ...a, ordinal: i }) as GeneratedArtifact),
    });
  }

  private async record(ctx: AuthenticatedContext, sectionId: string, eventType: string, chartId: string, reopened: boolean): Promise<void> {
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType, entityType: "report_section", entityId: sectionId, newValue: reopened ? `${chartId} (section reopened)` : chartId });
  }
}

const chartIdOf = (a: { payload: unknown }): string | undefined => (a.payload as GeneratedChartSpec | null)?.dataCenter?.id;

const keep = (a: ReportArtifactRecord | GeneratedArtifact): GeneratedArtifact =>
  ({ kind: a.kind, caption: a.caption ?? undefined, ordinal: a.ordinal, payload: a.payload, sourceReferences: "sourceReferences" in a ? a.sourceReferences : [] }) as GeneratedArtifact;
