import type { Result } from "@donordesk/domain";
import { DomainError, SubmissionSnapshot, canApproveAssurance, plainRequirementName } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type {
  IReportDraftRepository,
  IReportSectionRepository,
  IReportClaimRepository,
  IReportRevisionRepository,
  IResolvedRequirementsRepository,
  ISubmissionSnapshotRepository,
  IGenerationRunRepository,
  IReportingPeriodRepository,
  IRequirementResolver,
} from "../../ports/reporting.js";
import type { ApproveReportHandler } from "./approve-report.js";
import type { IIdGenerator, IAuditLogger } from "../../ports/core.js";
import type { IEventBus } from "../../ports/core.js";
import { ReportSubmissionSnapshotCreated } from "@donordesk/domain";

/**
 * Seals the immutable donor-submission snapshot. Requires every section to
 * point at a CURRENT-assurance revision, the aggregate gate to pass, the
 * period's effective requirements to be resolved, and the draft's generation
 * run to match the period's locked template/mapping version. Every donor-facing
 * export must reference exactly one snapshot.
 */
export class CreateSubmissionSnapshotHandler {
  constructor(
    private readonly ids: IIdGenerator,
    private readonly drafts: IReportDraftRepository,
    private readonly sections: IReportSectionRepository,
    private readonly claims: IReportClaimRepository,
    private readonly revisions: IReportRevisionRepository,
    private readonly requirements: IResolvedRequirementsRepository,
    private readonly snapshots: ISubmissionSnapshotRepository,
    private readonly periods: IReportingPeriodRepository,
    private readonly generationRuns: IGenerationRunRepository,
    private readonly gate: ApproveReportHandler,
    private readonly audit: IAuditLogger,
    private readonly events: IEventBus,
    /** Resolves the period's requirements when none were stored (a draft that predates resolution, or a resolver that failed then). */
    private readonly requirementResolver?: IRequirementResolver,
  ) {}

  async handle(ctx: AuthenticatedContext, draftId: string): Promise<Result<{ id: string }, DomainError>> {
    const draftResult = await this.drafts.findById(draftId, ctx.tenant.tenantId);
    if (!draftResult.ok) return draftResult;
    const draft = draftResult.value;
    if (!draft) return { ok: false, error: DomainError.notFound("ReportDraft", draftId) };

    const gateResult = await this.gate.evaluateGate(ctx, draft.reportingPeriodId, draftId);
    if (!gateResult.ok) return gateResult;
    if (gateResult.value.submitBlocked || gateResult.value.submitNeedsDecision || gateResult.value.approvalBlocked) {
      return {
        ok: false,
        error: DomainError.reportGateBlocked(refusalMessage("The donor copy cannot be sealed yet", gateResult.value.blockReasons), {
          blockers: gateResult.value.blockReasons,
        }),
      };
    }

    const sectionsResult = await this.sections.findByReportDraft(draftId, ctx.tenant.tenantId);
    if (!sectionsResult.ok) return sectionsResult;
    const sections = sectionsResult.value;

    const approvedRevisionIds: string[] = [];
    const revisionHashes: Record<string, string> = {};
    const approvalRecords: Array<{ sectionId: string; revisionId: string; revisionHash: string; approvedById: string; approvedAt: Date }> = [];

    for (const section of sections) {
      if (!section.currentRevisionId) {
        return { ok: false, error: DomainError.reportGateBlocked(`Section "${section.sectionTitle}" has no current revision`) };
      }
      const revisionResult = await this.revisions.findById(section.currentRevisionId, ctx.tenant.tenantId);
      if (!revisionResult.ok) return revisionResult;
      const revision = revisionResult.value;
      if (!revision) return { ok: false, error: DomainError.notFound("ReportRevision", section.currentRevisionId) };
      if (!canApproveAssurance(revision.assuranceState)) {
        return { ok: false, error: DomainError.reportGateBlocked(`Section "${section.sectionTitle}" revision ${revision.revisionNumber} lacks CURRENT assurance`) };
      }
      if (section.status !== "APPROVED") {
        return { ok: false, error: DomainError.reportGateBlocked(`Section "${section.sectionTitle}" is not approved`) };
      }
      approvedRevisionIds.push(revision.id);
      revisionHashes[revision.id] = revision.contentHash;
      approvalRecords.push({
        sectionId: section.id,
        revisionId: revision.id,
        revisionHash: revision.contentHash,
        approvedById: ctx.tenant.userId,
        approvedAt: new Date(),
      });
    }

    const requirementsResult = await this.requirements.findLatestForPeriod(draft.reportingPeriodId, ctx.tenant.tenantId);
    if (!requirementsResult.ok) return requirementsResult;
    // Resolution is idempotent: sealing never fails merely because nobody resolved the requirements first.
    let resolved = requirementsResult.value;
    if (!resolved && this.requirementResolver) {
      const fresh = await this.requirementResolver.resolve({ tenantId: ctx.tenant.tenantId, reportingPeriodId: draft.reportingPeriodId, effectiveDate: new Date() });
      if (!fresh.ok) return fresh;
      resolved = fresh.value;
    }
    if (!resolved) {
      return {
        ok: false,
        error: DomainError.reportGateBlocked("The donor's reporting requirements for this report could not be worked out, so the copy cannot be sealed. Check the report's template and try again."),
      };
    }
    if (resolved.coverage.unmet.length > 0) {
      return {
        ok: false,
        error: DomainError.reportGateBlocked(refusalMessage("The report does not yet cover everything the donor requires", resolved.coverage.unmet.map(plainRequirementName)), {
          unmet: resolved.coverage.unmet,
        }),
      };
    }

    // Template/mapping version correctness: the draft's latest generation run
    // must have been produced against the period's locked template version.
    const periodResult = await this.periods.findById(draft.reportingPeriodId, ctx.tenant.tenantId);
    if (!periodResult.ok) return periodResult;
    const period = periodResult.value;
    if (period && period.donorTemplateVersion !== undefined) {
      const runsResult = await this.generationRuns.findByDraft(draftId, ctx.tenant.tenantId);
      if (!runsResult.ok) return runsResult;
      const latestRun = [...runsResult.value].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()).pop();
      if (!latestRun) {
        return { ok: false, error: DomainError.reportGateBlocked("Draft has no generation run; regenerate before submission") };
      }
      const runTemplateVersion = latestRun.snapshot.mappingVersion ?? latestRun.snapshot.templateVersion;
      if (runTemplateVersion !== period.donorTemplateVersion) {
        return {
          ok: false,
          error: DomainError.reportGateBlocked("Draft was generated against a different template version than the locked reporting period", {
            runTemplateVersion,
            lockedTemplateVersion: period.donorTemplateVersion,
          }),
        };
      }
    }

    const claimsResult = await this.claims.findByDraft(draftId, ctx.tenant.tenantId);
    if (!claimsResult.ok) return claimsResult;
    const claims = claimsResult.value;

    const assertionManifest = claims
      .filter((c) => (c.materiality ?? "MATERIAL") === "MATERIAL")
      .map((c) => ({
        assertionId: c.id,
        revisionId: c.revisionId ?? "",
        text: c.text,
        verificationResult: c.verificationResult,
        verificationReasonCode: c.verificationReasonCode,
      }));

    const evidenceManifest = new Map<string, { evidenceId: string; fileName: string; hash: string; confidentialityDecision: "INCLUDE" | "EXCLUDE" | "REDACTED" }>();
    for (const claim of claims) {
      for (const source of claim.sources) {
        const existing = evidenceManifest.get(source.evidenceId);
        if (existing) continue;
        evidenceManifest.set(source.evidenceId, {
          evidenceId: source.evidenceId,
          fileName: source.evidenceId,
          hash: source.evidenceHash,
          confidentialityDecision: claim.verificationReasonCode === "CONFIDENTIALITY_RESTRICTED" ? "EXCLUDE" : "INCLUDE",
        });
      }
    }

    const annexManifest = resolved.snapshot
      .filter((r) => r.kind === "ANNEX" || r.kind === "DECLARATION" || r.kind === "FINANCIAL")
      .map((r) => ({ annexTitle: r.key, populated: resolved.coverage.satisfied.includes(r.key) }));

    const overrides = claims
      .filter((c) => c.resolvedById !== undefined)
      .map((c) => ({
        claimId: c.id,
        resolution: (c.verificationResult === "EXCLUDED" ? "EXCLUDED" : "ACCEPTED_WITH_LIMITATION") as "ACCEPTED_WITH_LIMITATION" | "EXCLUDED",
        notes: c.resolutionNotes ?? "",
        authority: c.resolvedById ?? "",
      }));

    const snapshot = SubmissionSnapshot.create({
      id: this.ids.generate(),
      tenantId: ctx.tenant.tenantId.toString(),
      projectId: draft.projectId,
      reportDraftId: draftId,
      reportingPeriodId: draft.reportingPeriodId,
      approvedRevisionIds,
      revisionHashes,
      requirementSnapshotId: resolved.id,
      requirementCoverage: resolved.coverage,
      assertionManifest,
      evidenceManifest: [...evidenceManifest.values()],
      annexManifest,
      approvalRecords,
      overrides,
    });

    const saved = await this.snapshots.create(snapshot);
    if (!saved.ok) return saved;

    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "report.submission.snapshot.created",
      entityType: "submission_snapshot",
      entityId: snapshot.id,
      projectId: draft.projectId,
      newValue: JSON.stringify({
        approvedRevisions: approvedRevisionIds.length,
        assertions: assertionManifest.length,
        evidence: evidenceManifest.size,
        annexes: annexManifest.length,
        requirements: resolved.snapshot.length,
      }),
    });
    await this.events.publish([
      new ReportSubmissionSnapshotCreated(ctx.tenant.tenantId, snapshot.id, draftId, draft.reportingPeriodId),
    ]);

    return { ok: true, value: { id: snapshot.id } };
  }
}

/** "<what>: <reason>; <reason>" - the reasons the gate gave, in the words it gave them, so the user sees which rule failed. */
function refusalMessage(what: string, reasons: ReadonlyArray<string>): string {
  const shown = reasons.map((r) => r.trim()).filter(Boolean);
  return shown.length > 0 ? `${what}: ${shown.join("; ")}.` : `${what}.`;
}
