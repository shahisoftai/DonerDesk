import type { Result, Role } from "@donordesk/domain";
import { DomainError, Permissions, staleSynthesisSectionIds } from "@donordesk/domain";
import type { ReportDraft, ReportSection, ReportClaim } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type {
  IReportDraftRepository,
  IReportSectionRepository,
  IReportClaimRepository,
  IReportPlanRepository,
  IReportRevisionRepository,
  IReportArtifactRepository,
  IEvidenceDirectory,
  IReportInputsChangeReader,
  ISectionRegenerationTracker,
  EvidenceLabel,
} from "../../ports/reporting.js";
import type { ICommentCounter } from "../../ports/support.js";

/** Optional read collaborators used by the document-first editor (Report Editor v2). */
export interface GetReportDraftExtras {
  evidenceDirectory?: IEvidenceDirectory;
  inputsChangeReader?: IReportInputsChangeReader;
  regenerationTracker?: ISectionRegenerationTracker;
  commentCounter?: ICommentCounter;
}

const RESTRICTED_LEVELS = new Set(["SENSITIVE", "HIGHLY_SENSITIVE"]);
export const RESTRICTED_EVIDENCE_LABEL = "Restricted evidence";

export class GetReportDraftHandler {
  constructor(
    private readonly drafts: IReportDraftRepository,
    private readonly sections: IReportSectionRepository,
    private readonly claims: IReportClaimRepository,
    private readonly revisions: IReportRevisionRepository,
    private readonly plans: IReportPlanRepository,
    private readonly reportArtifacts?: IReportArtifactRepository,
    private readonly extras: GetReportDraftExtras = {},
  ) {}

  async handle(ctx: AuthenticatedContext, reportingPeriodId: string): Promise<Result<unknown, DomainError>> {
    const draftsResult = await this.drafts.findByReportingPeriod(reportingPeriodId, ctx.tenant.tenantId);
    if (!draftsResult.ok) return draftsResult;
    // Only the current working draft is surfaced in the workspace; superseded
    // drafts (older generations, cancelled runs) are listed under versions.
    const allDrafts = draftsResult.value;
    const draft = allDrafts.find((d) => !d.isSuperseded) ?? null;
    if (!draft) {
      return { ok: true, value: { draft: null, sections: [], claims: [], plan: null, artifacts: {}, versions: allDrafts.map(serializeDraftVersion) } };
    }

    const sectionsResult = await this.sections.findByReportDraft(draft.id, ctx.tenant.tenantId);
    if (!sectionsResult.ok) return sectionsResult;
    const claimsResult = await this.claims.findByDraft(draft.id, ctx.tenant.tenantId);
    if (!claimsResult.ok) return claimsResult;
    const plansResult = await this.plans.findByReportingPeriod(reportingPeriodId, ctx.tenant.tenantId);
    if (!plansResult.ok) return plansResult;

    const sorted = [...sectionsResult.value].sort((a, b) => a.sectionOrder - b.sectionOrder);

    // Which sections were produced by an AI model? A section whose current
    // revision carries a modelId was drafted by the configured provider; a
    // stub fallback or a later manual edit produces a revision without one.
    const revisionsResult = await this.revisions.findByDraft(draft.id, ctx.tenant.tenantId);
    const revisions = revisionsResult.ok ? revisionsResult.value : [];
    const revisionById = new Map(revisions.map((rev) => [rev.id, rev]));

    // AI Reporter 2 — fetch typed artifacts per section in one batch.
    const artifactsBySection: Record<string, unknown> = {};
    if (this.reportArtifacts) {
      for (const section of sorted) {
        const r = await this.reportArtifacts.findBySection(section.id, ctx.tenant.tenantId);
        if (r.ok && r.value.length > 0) {
          artifactsBySection[section.id] = r.value.map((art) => ({
            id: art.id,
            kind: art.kind,
            ordinal: art.ordinal,
            caption: art.caption,
            payload: art.payload,
            sourceReferences: art.sourceReferences,
            rows: art.rows,
            createdAt: art.createdAt.toISOString(),
          }));
        }
      }
    }

    const labelOf = await this.evidenceLabeler(ctx, sorted, claimsResult.value);
    const sectionIds = sorted.map((s) => s.id);

    return {
      ok: true,
      value: {
        draft: {
          id: draft.id,
          title: draft.title,
          status: draft.status,
          version: draft.version,
          generatedByAi: draft.generatedByAi,
          createdById: draft.createdById,
          approvedById: draft.approvedById,
          approvedAt: draft.approvedAt?.toISOString(),
          createdAt: draft.createdAt.toISOString(),
        },
        sections: sorted.map((s) => {
          const current = s.currentRevisionId ? revisionById.get(s.currentRevisionId) : undefined;
          return {
            id: s.id,
            sectionTitle: s.sectionTitle,
            sectionOrder: s.sectionOrder,
            level: s.level,
            numbering: s.numbering ?? null,
            content: s.content,
            sourceReferences: s.sourceReferences.map((ref) =>
              ref.type === "evidence" && labelOf(ref.id) ? { ...ref, evidenceTitle: labelOf(ref.id) } : ref,
            ),
            unsupportedClaims: s.unsupportedClaims,
            status: s.status,
            chartConfig: s.chartConfig,
            updatedAt: s.updatedAt.toISOString(),
            generatedWithAi: s.currentRevisionId ? (current?.modelId ?? null) !== null : null,
            assuranceState: current?.assuranceState ?? null,
          };
        }),
        claims: claimsResult.value.map((c) => ({
          id: c.id,
          sectionId: c.sectionId,
          text: c.text,
          type: c.type,
          sources: c.sources.map((src) => ({ ...src, evidenceTitle: labelOf(src.evidenceId) })),
          verificationResult: c.verificationResult,
          verificationDetail: c.verificationDetail,
          verificationReasonCode: c.verificationReasonCode,
          materiality: c.materiality,
          charStart: c.charStart,
          charEnd: c.charEnd,
          resolutionNotes: c.resolutionNotes,
          resolvedById: c.resolvedById,
          resolvedAt: c.resolvedAt?.toISOString(),
        })),
        plan: plansResult.value[0] ?? null,
        artifacts: artifactsBySection,
        versions: allDrafts.map(serializeDraftVersion),
        regeneratingSectionIds: this.extras.regenerationTracker?.runningAmong(sectionIds) ?? [],
        summaryStaleSectionIds: staleSynthesisSectionIds(
          sorted.map((s) => ({ id: s.id, title: s.sectionTitle, currentRevisionId: s.currentRevisionId })),
          revisions.map((rev) => ({
            id: rev.id,
            sectionId: rev.sectionId,
            revisionNumber: rev.revisionNumber,
            content: rev.content,
            changeOrigin: rev.changeOrigin,
            createdAt: rev.createdAt,
          })),
        ),
        commentCounts: await this.commentCounts(ctx, sectionIds),
        inputsChangedSince: await this.inputsChangedSince(ctx, draft, sorted, claimsResult.value),
      },
    };
  }

  /**
   * B2 — evidence titles for claim sources and section references, looked up
   * once per request. Sensitive files show a neutral label unless the caller
   * holds the grants-level confidentiality authority.
   */
  private async evidenceLabeler(
    ctx: AuthenticatedContext,
    sections: ReportSection[],
    claims: ReportClaim[],
  ): Promise<(evidenceId: string) => string | undefined> {
    const directory = this.extras.evidenceDirectory;
    if (!directory) return () => undefined;
    const ids = new Set<string>();
    for (const s of sections) for (const ref of s.sourceReferences) if (ref.type === "evidence") ids.add(ref.id);
    for (const c of claims) for (const src of c.sources) ids.add(src.evidenceId);
    if (ids.size === 0) return () => undefined;
    const described = await directory.describe([...ids], ctx.tenant.tenantId);
    if (!described.ok) return () => undefined;
    const maySeeRestricted = Permissions.can(ctx.tenant.role as Role, "report.override-confidentiality");
    const labels = new Map<string, string>(
      described.value.map((e: EvidenceLabel) => [e.id, RESTRICTED_LEVELS.has(e.confidentialityLevel) && !maySeeRestricted ? RESTRICTED_EVIDENCE_LABEL : e.title]),
    );
    return (evidenceId) => labels.get(evidenceId);
  }

  private async commentCounts(ctx: AuthenticatedContext, sectionIds: string[]): Promise<Record<string, number>> {
    if (!this.extras.commentCounter || sectionIds.length === 0) return {};
    const counts = await this.extras.commentCounter.countOpenByEntities("report_section", sectionIds, ctx.tenant.tenantId);
    return counts.ok ? counts.value : {};
  }

  /**
   * B6 — indicator values and evidence changed after the draft was written,
   * and the sections that cite them. Read-only: the editor offers a re-check
   * (reassessment), never an automatic rewrite.
   */
  private async inputsChangedSince(
    ctx: AuthenticatedContext,
    draft: ReportDraft,
    sections: ReportSection[],
    claims: ReportClaim[],
  ): Promise<{ indicators: number; evidence: number; sectionIds: string[] } | null> {
    const reader = this.extras.inputsChangeReader;
    if (!reader || draft.status !== "DRAFT") return null;
    const changed = await reader.changedSince({ reportingPeriodId: draft.reportingPeriodId, since: draft.createdAt, tenantId: ctx.tenant.tenantId });
    if (!changed.ok) return null;
    const { indicatorIds, indicatorUpdateIds, evidenceIds } = changed.value;
    if (indicatorIds.length === 0 && evidenceIds.length === 0) return null;
    const changedIds = new Set([...indicatorIds, ...indicatorUpdateIds, ...evidenceIds]);
    const affected = new Set<string>();
    for (const s of sections) {
      if (s.sourceReferences.some((ref) => changedIds.has(ref.id))) affected.add(s.id);
    }
    for (const c of claims) {
      if (c.sources.some((src) => changedIds.has(src.evidenceId))) affected.add(c.sectionId);
    }
    return {
      indicators: indicatorIds.length,
      evidence: evidenceIds.length,
      sectionIds: sections.filter((s) => affected.has(s.id)).map((s) => s.id),
    };
  }
}

function serializeDraftVersion(d: ReportDraft): Record<string, unknown> {
  return {
    id: d.id,
    title: d.title,
    status: d.status,
    version: d.version,
    generatedByAi: d.generatedByAi,
    createdById: d.createdById,
    approvedById: d.approvedById,
    approvedAt: d.approvedAt?.toISOString() ?? null,
    supersededAt: d.supersededAt?.toISOString() ?? null,
    createdAt: d.createdAt.toISOString(),
  };
}
