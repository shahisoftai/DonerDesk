import { DomainError, type Result } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { GeneratedArtifact, IReportArtifactRepository, IReportDraftRepository, IReportSectionRepository, IReportingPeriodRepository, ReportArtifactRecord } from "../../ports/reporting.js";
import type { IAuditLogger, IIdGenerator } from "../../ports/core.js";
import type { IInfographicRepository } from "../../ports/infographics.js";
import { isInfographicArtifact } from "../../services/section-chart-service.js";

/** A published infographic picture as the report editor lists it for a section. */
export interface SectionInfographicView {
  id: string;
  caption: string;
  title: string;
  exportId: string;
  infographicId: string;
  pageCount: number;
  publishedAt: string;
  /** The design was edited after this picture was published (the picture itself never changes). */
  designChangedSince: boolean;
}

/** A published picture the project has, offered for placing in a report. */
export interface ProjectInfographicPicture {
  exportId: string;
  infographicId: string;
  title: string;
  format: string;
  pageCount: number;
  approved: boolean;
  publishedAt: string;
}

type Located = { projectId: string; reopened: boolean };

interface InfographicPayload {
  type: "BAR";
  title: string;
  caption: string;
  categories: [];
  series: [];
  sourceReferences: [];
  infographic: { id: string; exportId: string; infographicId: string; storageKey: string; title: string; pageCount: number; publishedAt: string };
}

const idOf = (a: { payload: unknown }): string | undefined => (a.payload as { infographic?: { id?: string } } | null)?.infographic?.id;
const keep = (a: ReportArtifactRecord | GeneratedArtifact): GeneratedArtifact => ({ kind: a.kind, caption: a.caption ?? undefined, ordinal: a.ordinal, payload: a.payload, sourceReferences: "sourceReferences" in a ? a.sourceReferences : [] }) as GeneratedArtifact;

/**
 * Pictures a person places in a report section from the project's published infographics. A placed picture is the exact file
 * that was published (its storage key is kept with the section), so an approved report never changes by itself; a text edit or a
 * regeneration keeps it. Placing, moving or removing one is an edit of the section and follows the same rules: the draft must
 * still be a draft, and an approved section is reopened.
 */
export class SectionInfographicsHandler {
  constructor(
    private readonly sections: IReportSectionRepository,
    private readonly drafts: IReportDraftRepository,
    private readonly periods: IReportingPeriodRepository,
    private readonly artifacts: IReportArtifactRepository,
    private readonly infographics: IInfographicRepository,
    private readonly ids: IIdGenerator,
    private readonly audit: IAuditLogger,
  ) {}

  /** The project's published pictures (PNG only: a report draws images), newest first. */
  async candidates(ctx: AuthenticatedContext, sectionId: string): Promise<Result<ProjectInfographicPicture[], DomainError>> {
    const located = await this.locate(ctx, sectionId, false);
    if (!located.ok) return located;
    const exports = await this.infographics.findExportsByProject(located.value.projectId, ctx.tenant.tenantId);
    if (!exports.ok) return exports;
    const out: ProjectInfographicPicture[] = [];
    for (const row of exports.value.filter((e) => e.format === "PNG")) {
      const design = await this.infographics.findById(row.infographicId, ctx.tenant.tenantId);
      out.push({ exportId: row.id, infographicId: row.infographicId, title: design.ok && design.value ? design.value.title : "Infographic", format: row.format, pageCount: row.pageCount, approved: row.approved, publishedAt: row.createdAt.toISOString() });
    }
    return { ok: true, value: out };
  }

  async list(ctx: AuthenticatedContext, sectionId: string): Promise<Result<SectionInfographicView[], DomainError>> {
    const located = await this.locate(ctx, sectionId, false);
    if (!located.ok) return located;
    const stored = await this.artifacts.findBySection(sectionId, ctx.tenant.tenantId);
    if (!stored.ok) return stored;
    const out: SectionInfographicView[] = [];
    for (const a of [...stored.value].filter((x) => x.kind === "CHART" && isInfographicArtifact(x.payload)).sort((x, y) => x.ordinal - y.ordinal)) {
      const p = (a.payload as InfographicPayload).infographic;
      const design = await this.infographics.findById(p.infographicId, ctx.tenant.tenantId);
      out.push({
        id: p.id,
        caption: a.caption ?? p.title,
        title: p.title,
        exportId: p.exportId,
        infographicId: p.infographicId,
        pageCount: p.pageCount,
        publishedAt: p.publishedAt,
        designChangedSince: design.ok && design.value ? design.value.updatedAt.toISOString() > p.publishedAt : false,
      });
    }
    return { ok: true, value: out };
  }

  async add(ctx: AuthenticatedContext, sectionId: string, input: { exportId: string; caption?: string }): Promise<Result<{ id: string }, DomainError>> {
    const located = await this.locate(ctx, sectionId, true);
    if (!located.ok) return located;
    const row = await this.infographics.findExportById(input.exportId, ctx.tenant.tenantId);
    if (!row.ok) return row;
    // Only a picture of this report's own project, and only a PNG (a report draws images, not slides or archives).
    if (!row.value || row.value.projectId !== located.value.projectId) return { ok: false, error: DomainError.notFound("Published infographic", input.exportId) };
    if (row.value.format !== "PNG") return { ok: false, error: DomainError.validation("Place the PNG version of an infographic in a report.") };
    const design = await this.infographics.findById(row.value.infographicId, ctx.tenant.tenantId);
    const title = design.ok && design.value ? design.value.title : "Infographic";
    const id = this.ids.generate();
    const all = await this.records(ctx, sectionId);
    if (!all.ok) return all;
    const caption = (input.caption ?? "").trim() || title;
    const payload: InfographicPayload = { type: "BAR", title, caption, categories: [], series: [], sourceReferences: [], infographic: { id, exportId: row.value.id, infographicId: row.value.infographicId, storageKey: row.value.storageKey, title, pageCount: row.value.pageCount, publishedAt: row.value.createdAt.toISOString() } };
    const artifact = { kind: "CHART", caption, ordinal: all.value.length, payload, sourceReferences: [] } as unknown as GeneratedArtifact;
    const saved = await this.save(ctx, sectionId, [...all.value.map(keep), artifact]);
    if (!saved.ok) return saved;
    await this.record(ctx, sectionId, "report.section.infographic.added", id, located.value.reopened);
    return { ok: true, value: { id } };
  }

  async caption(ctx: AuthenticatedContext, sectionId: string, pictureId: string, caption: string): Promise<Result<{ id: string }, DomainError>> {
    const located = await this.locate(ctx, sectionId, true);
    if (!located.ok) return located;
    const all = await this.records(ctx, sectionId);
    if (!all.ok) return all;
    const found = all.value.find((a) => idOf(a) === pictureId);
    if (!found) return { ok: false, error: DomainError.notFound("Picture", pictureId) };
    const text = caption.trim() || ((found.payload as InfographicPayload).infographic.title);
    const next = all.value.map((a) => (a === found ? ({ ...keep(a), caption: text, payload: { ...(a.payload as object), caption: text } } as GeneratedArtifact) : keep(a)));
    const saved = await this.save(ctx, sectionId, next);
    if (!saved.ok) return saved;
    await this.record(ctx, sectionId, "report.section.infographic.captioned", pictureId, located.value.reopened);
    return { ok: true, value: { id: pictureId } };
  }

  async remove(ctx: AuthenticatedContext, sectionId: string, pictureId: string): Promise<Result<{ removed: true }, DomainError>> {
    const located = await this.locate(ctx, sectionId, true);
    if (!located.ok) return located;
    const all = await this.records(ctx, sectionId);
    if (!all.ok) return all;
    if (!all.value.some((a) => idOf(a) === pictureId)) return { ok: false, error: DomainError.notFound("Picture", pictureId) };
    const saved = await this.save(ctx, sectionId, all.value.filter((a) => idOf(a) !== pictureId).map(keep));
    if (!saved.ok) return saved;
    await this.record(ctx, sectionId, "report.section.infographic.removed", pictureId, located.value.reopened);
    return { ok: true, value: { removed: true } };
  }

  async move(ctx: AuthenticatedContext, sectionId: string, pictureId: string, direction: "UP" | "DOWN"): Promise<Result<{ moved: boolean }, DomainError>> {
    const located = await this.locate(ctx, sectionId, true);
    if (!located.ok) return located;
    const all = await this.records(ctx, sectionId);
    if (!all.ok) return all;
    const mine = all.value.filter((a) => isInfographicArtifact(a.payload));
    const at = mine.findIndex((a) => idOf(a) === pictureId);
    if (at < 0) return { ok: false, error: DomainError.notFound("Picture", pictureId) };
    const to = direction === "UP" ? at - 1 : at + 1;
    if (to < 0 || to >= mine.length) return { ok: true, value: { moved: false } };
    const reordered = [...mine];
    [reordered[at], reordered[to]] = [reordered[to]!, reordered[at]!];
    const others = all.value.filter((a) => !isInfographicArtifact(a.payload));
    const saved = await this.save(ctx, sectionId, [...others, ...reordered].map(keep));
    if (!saved.ok) return saved;
    await this.record(ctx, sectionId, "report.section.infographic.moved", pictureId, located.value.reopened);
    return { ok: true, value: { moved: true } };
  }

  // -------------------------------------------------------------------------

  private async locate(ctx: AuthenticatedContext, sectionId: string, forChange: boolean): Promise<Result<Located, DomainError>> {
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
        return { ok: false, error: DomainError.invalidTransition(draft.value.isSuperseded ? "This is an older version of the report and can no longer be edited." : "This report is no longer a draft, so its pictures cannot be changed.") };
      }
      if (section.status === "APPROVED") {
        section.resetToDraft();
        const saved = await this.sections.update(section);
        if (!saved.ok) return saved;
        reopened = true;
      }
    }
    return { ok: true, value: { projectId: period.value.projectId, reopened } };
  }

  private async records(ctx: AuthenticatedContext, sectionId: string): Promise<Result<ReportArtifactRecord[], DomainError>> {
    const stored = await this.artifacts.findBySection(sectionId, ctx.tenant.tenantId);
    if (!stored.ok) return stored;
    return { ok: true, value: [...stored.value].sort((a, b) => a.ordinal - b.ordinal) };
  }

  private async save(ctx: AuthenticatedContext, sectionId: string, artifacts: GeneratedArtifact[]): Promise<Result<void, DomainError>> {
    return this.artifacts.replaceForSection({ tenantId: ctx.tenant.tenantId, sectionId, revisionId: null, artifacts: artifacts.map((a, i) => ({ ...a, ordinal: i }) as GeneratedArtifact) });
  }

  private async record(ctx: AuthenticatedContext, sectionId: string, eventType: string, pictureId: string, reopened: boolean): Promise<void> {
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType, entityType: "report_section", entityId: sectionId, newValue: reopened ? `${pictureId} (section reopened)` : pictureId });
  }
}
