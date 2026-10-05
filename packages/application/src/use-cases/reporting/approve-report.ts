import type { Result } from "@donordesk/domain";
import { DomainError, evaluateReportGate, gateKindForReason, canApproveAssurance, lintReportContradictions, toLintFindingData, type GateKind, type ReportGateInput, type ContradictionLintFindingData } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { ILintGrounding } from "../../services/lint-grounding.js";
import type {
  IReportDraftRepository,
  IReportingPeriodRepository,
  IReportSectionRepository,
  IReportClaimRepository,
  IReportRevisionRepository,
  IResolvedRequirementsRepository,
  IIndicatorAnalyticsService,
} from "../../ports/reporting.js";
import type { IChecklistRepository } from "../../ports/compliance.js";
import type { IAuditLogger } from "../../ports/core.js";

/**
 * Approves a report when the aggregate gate passes. The gate consumes
 * structured reason codes (never prose detail), current revision assurance,
 * material-assertion coverage, and resolved-requirement coverage so approval,
 * readiness, preflight, and export decisions are identical for identical
 * inputs.
 */
export class ApproveReportHandler {
  constructor(
    private readonly drafts: IReportDraftRepository,
    private readonly periods: IReportingPeriodRepository,
    private readonly checklist: IChecklistRepository,
    private readonly claims: IReportClaimRepository,
    private readonly sections: IReportSectionRepository,
    private readonly revisions: IReportRevisionRepository,
    private readonly requirements: IResolvedRequirementsRepository,
    private readonly audit: IAuditLogger,
    /**
     * Optional deterministic analytics used by the cross-section
     * contradiction lint. When absent, the gate still runs the
     * content-only lint checks (divergence, dates, disaggregation).
     */
    private readonly analytics?: IIndicatorAnalyticsService,
    /** Figures the project's own records state (budget, counts, life-of-project totals) so the lint does not flag them. */
    private readonly lintGrounding?: ILintGrounding,
  ) {}

  async handle(ctx: AuthenticatedContext, draftId: string): Promise<Result<void, DomainError>> {
    const draftResult = await this.drafts.findById(draftId, ctx.tenant.tenantId);
    if (!draftResult.ok) return draftResult;
    const draft = draftResult.value;
    if (!draft) return { ok: false, error: DomainError.notFound("ReportDraft", draftId) };

    const gate = await this.evaluateGate(ctx, draft.reportingPeriodId, draftId);
    if (!gate.ok) return gate;
    const result = gate.value;
    if (result.approvalBlocked) {
      const reasons = result.blockReasons.length > 0 ? result.blockReasons : ["Some report issues still need to be resolved"];
      return {
        ok: false,
        error: DomainError.reportGateBlocked(`Report cannot be approved yet: ${reasons.join("; ")}`, {
          blockers: result.blockReasons,
        }),
      };
    }

    draft.approve(ctx.tenant.userId);
    const savedDraft = await this.drafts.update(draft);
    if (!savedDraft.ok) return savedDraft;

    const periodResult = await this.periods.findById(draft.reportingPeriodId, ctx.tenant.tenantId);
    if (!periodResult.ok) return periodResult;
    if (periodResult.value) {
      periodResult.value.transitionTo(periodResult.value.status);
      await this.periods.update(periodResult.value);
    }

    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "report.approved",
      entityType: "report_draft",
      entityId: draftId,
      projectId: draft.projectId,
    });
    return { ok: true, value: undefined };
  }

  async evaluateGate(ctx: AuthenticatedContext, reportingPeriodId: string, draftId: string): Promise<Result<{
    approvalBlocked: boolean;
    submitBlocked: boolean;
    submitNeedsDecision: boolean;
    blockReasons: string[];
    blockingIssues: Array<{
      kind: GateKind;
      detail: string;
      claimId?: string;
      sectionId?: string;
      evidenceId?: string;
    }>;
  }, DomainError>> {
    const checklistResult = await this.checklist.findByReportingPeriod(reportingPeriodId, ctx.tenant.tenantId);
    if (!checklistResult.ok) return checklistResult;
    const openSensitive = checklistResult.value.filter(
      (i) => i.type === "SENSITIVE_DATA_WARNING" && (i.status === "OPEN" || i.status === "IN_PROGRESS"),
    );
    const openCritical = checklistResult.value.filter(
      (i) => (i.severity === "CRITICAL" || i.severity === "HIGH") && (i.status === "OPEN" || i.status === "IN_PROGRESS"),
    );

    const claimsResult = await this.claims.findByDraft(draftId, ctx.tenant.tenantId);
    if (!claimsResult.ok) return claimsResult;
    const claims = claimsResult.value;

    // Revision assurance: every section must point at a CURRENT revision.
    const sectionsResult = await this.sections.findByReportDraft(draftId, ctx.tenant.tenantId);
    if (!sectionsResult.ok) return sectionsResult;
    const sectionTitleById = new Map(sectionsResult.value.map((s) => [s.id, s.sectionTitle]));

    const claimOutcomes: Array<{ kind: GateKind; detail: string; claimId?: string; sectionId?: string; evidenceId?: string }> = [];
    let unresolvedSemantics = 0;

    for (const claim of claims) {
      const sectionTitle = sectionTitleById.get(claim.sectionId);
      const sectionPrefix = sectionTitle ? `Section "${sectionTitle}": ` : "";
      const claimText = claim.text.length > 120 ? claim.text.slice(0, 117) + "…" : claim.text;
      if (claim.verificationResult === "PASSED") {
        claimOutcomes.push({ kind: "VERIFIED", detail: claim.verificationDetail, claimId: claim.id, sectionId: claim.sectionId });
        continue;
      }
      // A manually resolved claim (accepted-with-limitation or excluded) is
      // no longer a blocking gate. The resolver records resolutionNotes +
      // resolvedById while leaving verificationResult as FAILED, so honour the
      // resolution marker here rather than the (unchanged) verification result.
      if (
        claim.verificationResult === "ACCEPTED_WITH_LIMITATION" ||
        claim.verificationResult === "EXCLUDED" ||
        claim.resolvedById !== undefined
      ) {
        continue;
      }
      // P0-3 / report-quality: a NOT_MATERIAL failed claim (metadata, grounded
      // narrative, references) is not a blocking issue and must not surface in
      // Smart Review or block approval. Only MATERIAL failures count. This keeps
      // legitimate content (activity lines, story context, summary counts) from
      // flooding the review as "needs stronger supporting evidence".
      if (claim.materiality !== "MATERIAL") {
        continue;
      }
      // Surface the first source's evidenceId so the preflight UI can link to
      // the underlying evidence file when the issue is an evidence-hash mismatch.
      const firstEvidenceId = claim.sources[0]?.evidenceId;
      const ctx: { kind: GateKind; detail: string; claimId: string; sectionId: string; evidenceId?: string } = {
        kind: "UNSUPPORTED_MATERIAL_CLAIM",
        detail: `${sectionPrefix}${claimText} — ${claim.verificationDetail}`,
        claimId: claim.id,
        sectionId: claim.sectionId,
      };
      if (firstEvidenceId) ctx.evidenceId = firstEvidenceId;
      if (claim.verificationReasonCode) {
        ctx.kind = gateKindForReason(claim.verificationReasonCode);
        claimOutcomes.push(ctx);
        continue;
      }
      // Legacy claims without a structured reason code: keep the historical
      // deterministic classification until they are reassessed.
      const detail = claim.verificationDetail.toLowerCase();
      if (detail.includes("unresolved semantics")) {
        unresolvedSemantics++;
        continue;
      }
      if (detail.includes("contradict")) {
        ctx.kind = "NUMERIC_CONTRADICTION";
        claimOutcomes.push(ctx);
        continue;
      }
      if (claim.type === "NUMERIC" || claim.type === "CAUSAL") {
        claimOutcomes.push(ctx);
      }
    }

    for (const section of sectionsResult.value) {
      if (!section.currentRevisionId) {
        if (section.content.trim()) {
          claimOutcomes.push({ kind: "ASSERTION_COVERAGE_GAP", detail: `Section "${section.sectionTitle}" has content but no assessed revision`, sectionId: section.id });
        }
        continue;
      }
      const revisionResult = await this.revisions.findById(section.currentRevisionId, ctx.tenant.tenantId);
      if (!revisionResult.ok) return revisionResult;
      const revision = revisionResult.value;
      if (!revision || !canApproveAssurance(revision.assuranceState)) {
        claimOutcomes.push({
          kind: revision?.assuranceState === "STALE" ? "VERIFICATION_STALE" : "ASSERTION_COVERAGE_GAP",
          detail: `Section "${section.sectionTitle}" has ${revision?.assuranceState ?? "missing"} assurance`,
          sectionId: section.id,
        });
      }
      if (section.content.trim() && claims.filter((c) => c.sectionId === section.id).length === 0) {
        claimOutcomes.push({ kind: "ASSERTION_COVERAGE_GAP", detail: `Section "${section.sectionTitle}" has content with no registered assertions`, sectionId: section.id });
      }
    }

    // Resolved requirement coverage: unmet mandatory requirements block.
    const requirementsResult = await this.requirements.findLatestForPeriod(reportingPeriodId, ctx.tenant.tenantId);
    if (!requirementsResult.ok) return requirementsResult;
    const resolved = requirementsResult.value;
    if (resolved && resolved.coverage.unmet.length > 0) {
      for (const key of resolved.coverage.unmet) {
        claimOutcomes.push({ kind: "REQUIREMENT_UNSATISFIED", detail: `Mandatory requirement unsatisfied: ${key}` });
      }
    }

    for (const item of openSensitive) {
      claimOutcomes.push({ kind: "CONFIDENTIALITY_VIOLATION", detail: item.title, sectionId: item.relatedEntityId ?? undefined });
    }

    for (const item of openCritical) {
      claimOutcomes.push({ kind: "REQUIREMENT_UNSATISFIED", detail: `Open ${item.severity.toLowerCase()} checklist item: ${item.title}`, sectionId: item.relatedEntityId ?? undefined });
    }

    // Cross-section contradiction lint (content-derived). BLOCKER findings map
    // onto NUMERIC_CONTRADICTION (approval: BLOCK). They are recomputed from
    // the current section text on every evaluation and are never persisted as
    // claims, so they cannot be closed with an ACCEPTED_WITH_LIMITATION note —
    // only by correcting the report text.
    const lintFindingsData: ContradictionLintFindingData[] = [];
    let groundedFigures: string[] = [];
    if (this.analytics) {
      const draftResult = await this.drafts.findById(draftId, ctx.tenant.tenantId);
      const draftRecord = draftResult.ok ? draftResult.value : null;
      if (draftRecord) {
        const computed = await this.analytics.computeFindings({
          reportingPeriodId,
          projectId: draftRecord.projectId,
          tenantId: ctx.tenant.tenantId,
        });
        if (computed.ok) {
          for (const f of computed.value) lintFindingsData.push(toLintFindingData(f));
          if (this.lintGrounding) {
            groundedFigures = await this.lintGrounding.figures({ tenantId: ctx.tenant.tenantId, projectId: draftRecord.projectId, reportingPeriodId, findings: computed.value });
          }
        }
      }
      // Analytics or draft-lookup failure degrades gracefully: the lint still
      // runs without the findings-backed value checks.
    }
    const lintPeriod = await this.periods.findById(reportingPeriodId, ctx.tenant.tenantId);
    const lintPeriodValue = lintPeriod.ok ? lintPeriod.value : null;
    const lint = lintReportContradictions({
      sections: sectionsResult.value.map((s) => ({ id: s.id, title: s.sectionTitle, content: s.content })),
      findings: lintFindingsData,
      groundedFigures,
      periodStart: lintPeriodValue?.duration?.start?.toISOString(),
      periodEnd: lintPeriodValue?.duration?.end?.toISOString(),
    });
    for (const finding of lint.findings) {
      if (finding.severity !== "BLOCKER") continue;
      claimOutcomes.push({
        kind: "NUMERIC_CONTRADICTION",
        detail: `${finding.sectionTitle}: ${finding.detail}`,
        sectionId: finding.sectionId || undefined,
      });
    }

    const gateInput: ReportGateInput = {
      claimOutcomes,
      unresolvedSemantics: unresolvedSemantics,
    };
    const result = evaluateReportGate(gateInput);
    return {
      ok: true,
      value: {
        approvalBlocked: result.approvalBlocked,
        submitBlocked: result.submitBlocked,
        submitNeedsDecision: result.submitNeedsDecision,
        blockReasons: result.blockReasons,
        blockingIssues: result.blockingIssues,
      },
    };
  }
}
