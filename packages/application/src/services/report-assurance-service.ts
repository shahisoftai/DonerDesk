import type {
  FinanceSummaryView,
  Result,
  TenantId,
  VerifiedFinding,
  ClaimSource,
} from "@donordesk/domain";
import { DomainError, ReportClaim, computeCoverageMetrics, plainVerificationReason } from "@donordesk/domain";
import type {
  IReportAssuranceService,
  AssessRevisionResult,
  IReportSectionRepository,
  IReportDraftRepository,
  IReportRevisionRepository,
  IReportClaimRepository,
  IAssertionExtractor,
  IClaimVerifier,
  IIndicatorAnalyticsService,
  IEvidencePackageBuilder,
  IRecordChunkBuilder,
  RecordChunk,
  EvidencePackage,
  ReportClaimDraft,
} from "../ports/reporting.js";
import type { IIdGenerator } from "../ports/core.js";
import type { IUnsupportedClaimProjector } from "../ports/compliance.js";
import type { IFinanceInputs } from "./finance-inputs.js";
import { recordChunksFromEvidence, recordChunksFromFinance, recordChunksFromFindings } from "./record-chunk-builder.js";
import type { ClaimType } from "@donordesk/domain";

export function assertionToClaimType(type: string): ClaimType {
  switch (type) {
    case "NUMERIC":
      return "NUMERIC";
    case "CAUSAL":
      return "CAUSAL";
    case "QUALITATIVE":
      return "QUALITATIVE";
    default:
      return "FACTUAL";
  }
}

function buildClaimSource(
  evidenceId: string,
  chunkId: string,
  sourceText: string,
  packages: EvidencePackage[],
): ClaimSource {
  const pkg = packages.find((p) => p.evidenceId === evidenceId);
  return {
    evidenceId,
    chunkId,
    sourceText,
    evidenceHash: pkg?.evidenceHash ?? "",
    evidenceUpdatedAt: pkg?.evidenceUpdatedAt ?? new Date(),
    chunkerVersion: pkg?.chunkerVersion ?? "unknown",
  };
}

/**
 * Runs the assurance pipeline for one revision (Phases 1-4): extract
 * assertions from final content, reconcile writer claims, verify every
 * material assertion through the composed verifier, persist revision-bound
 * claims, and set the revision's assurance state.
 */
export class ReportAssuranceService implements IReportAssuranceService {
  constructor(
    private readonly ids: IIdGenerator,
    private readonly sections: IReportSectionRepository,
    private readonly drafts: IReportDraftRepository,
    private readonly revisions: IReportRevisionRepository,
    private readonly claims: IReportClaimRepository,
    private readonly extractor: IAssertionExtractor,
    private readonly verifier: IClaimVerifier,
    private readonly analytics: IIndicatorAnalyticsService,
    private readonly evidencePackages: IEvidencePackageBuilder,
    private readonly projector?: IUnsupportedClaimProjector,
    /** Absent when the deployment has no finance support: financial figures are not grounded. */
    private readonly finance?: IFinanceInputs,
    /** Absent: factual claims are checked against evidence files only. */
    private readonly records?: IRecordChunkBuilder,
  ) {}

  async assessRevision(input: {
    ctx: { tenantId: TenantId; userId: string };
    sectionId: string;
    revisionId: string;
    writerClaims?: ReportClaimDraft[];
    findings?: VerifiedFinding[];
    evidencePackages?: EvidencePackage[];
  }): Promise<Result<AssessRevisionResult, DomainError>> {
    const { tenantId } = input.ctx;
    const sectionResult = await this.sections.findById(input.sectionId, tenantId);
    if (!sectionResult.ok) return sectionResult;
    const section = sectionResult.value;
    if (!section) return { ok: false, error: DomainError.notFound("ReportSection", input.sectionId) };

    const revisionResult = await this.revisions.findById(input.revisionId, tenantId);
    if (!revisionResult.ok) return revisionResult;
    const revision = revisionResult.value;
    if (!revision) return { ok: false, error: DomainError.notFound("ReportRevision", input.revisionId) };
    if (revision.sectionId !== section.id) {
      return { ok: false, error: DomainError.invariant("Revision does not belong to this section") };
    }

    const draftResult = await this.drafts.findById(section.reportDraftId, tenantId);
    if (!draftResult.ok) return draftResult;
    const draft = draftResult.value;
    if (!draft) return { ok: false, error: DomainError.notFound("ReportDraft", section.reportDraftId) };

    let findings = input.findings;
    if (!findings) {
      const findingsResult = await this.analytics.computeFindings({
        reportingPeriodId: draft.reportingPeriodId,
        projectId: draft.projectId,
        tenantId,
      });
      if (!findingsResult.ok) return findingsResult;
      findings = findingsResult.value;
    }

    // Verified financial figures ground the numbers a financial section quotes.
    let financeView: FinanceSummaryView | undefined;
    if (this.finance) {
      const finance = await this.finance.verifiedForPeriod(draft.reportingPeriodId, draft.projectId, tenantId);
      if (!finance.ok) return finance;
      financeView = finance.value;
    }

    // The project's own records ground factual claims that restate them; loaded once per revision.
    let recordChunks: RecordChunk[] = [];
    if (this.records) {
      const built = await this.records.build({ tenantId, projectId: draft.projectId, reportingPeriodId: draft.reportingPeriodId });
      if (built.ok) recordChunks = built.value;
    }
    // The verified findings and finance are records too: a sentence restating one is supported by it.
    recordChunks = [...recordChunks, ...recordChunksFromFindings(findings), ...(financeView ? recordChunksFromFinance(financeView) : [])];

    const writerClaims = input.writerClaims ?? [];
    const evidenceIds = new Set<string>();
    const cited = new Set<string>();
    for (const c of writerClaims) {
      for (const s of c.proposedSources) { evidenceIds.add(s.evidenceId); cited.add(s.evidenceId); }
    }
    let packages = input.evidencePackages;
    if (!packages) {
      // Only generation hands over the period's evidence. A re-assessment (an edit, a resolved statement, "reassess")
      // has no writer claims, so without this it would verify against nothing and every claim would get weaker.
      if (this.records) {
        const periodEvidence = await this.records.evidenceIds({ tenantId, projectId: draft.projectId, reportingPeriodId: draft.reportingPeriodId });
        if (periodEvidence.ok) for (const id of periodEvidence.value) evidenceIds.add(id);
      }
      const packagesResult = await this.evidencePackages.build({ tenantId, evidenceIds: [...evidenceIds] });
      if (!packagesResult.ok) return packagesResult;
      // Restricted files never support a statement unless the writer cited one (integrity then rejects it).
      packages = packagesResult.value.filter((p) => cited.has(p.evidenceId) || (p.confidentialityLevel !== "SENSITIVE" && p.confidentialityLevel !== "HIGHLY_SENSITIVE"));
    }
    // The evidence log restates the files on record (title, type, status, classification).
    recordChunks = [...recordChunks, ...recordChunksFromEvidence(packages)];

    const extraction = await this.extractor.extract({ content: revision.content, writerClaims });
    if (!extraction.ok) return extraction;
    const assertions = extraction.value;

    // P0-1 — Carry prior user resolutions forward so a reassessment never
    // silently resurrects a claim the user accepted-with-a-limitation or
    // excluded. Resolution is keyed by the claim's stable fingerprint.
    const existingResult = await this.claims.findBySection(section.id, tenantId);
    const resolvedByFingerprint = new Map<string, { by: string; notes?: string; excluded: boolean }>();
    if (existingResult.ok) {
      for (const existing of existingResult.value) {
        if (existing.resolvedById !== undefined) {
          resolvedByFingerprint.set(existing.fingerprint, {
            by: existing.resolvedById,
            notes: existing.resolutionNotes,
            excluded: existing.verificationResult === "EXCLUDED",
          });
        }
      }
    }

    const revisionHash = revision.contentHash;
    const persisted: ReportClaim[] = [];

    for (const assertion of assertions) {
      const claimType = assertionToClaimType(assertion.type);
      const claim = ReportClaim.assert({
        id: this.ids.generate(),
        tenantId: tenantId.toString(),
        projectId: draft.projectId,
        reportDraftId: draft.id,
        sectionId: section.id,
        text: assertion.text,
        type: claimType,
        sources: assertion.sources.map((s) => buildClaimSource(s.evidenceId, s.chunkId, s.sourceText, packages)),
        charStart: assertion.charStart,
        charEnd: assertion.charEnd,
        numericAtoms: assertion.numericAtoms,
        revisionId: revision.id,
        revisionHash,
        materiality: assertion.materiality,
      });
      const verification = await this.verifier.verify({
        claim: {
          text: assertion.text,
          type: claimType,
          assertionType: assertion.type,
          proposedSources: assertion.sources,
        },
        findings,
        evidencePackages: packages,
        ...(recordChunks.length > 0 ? { records: recordChunks } : {}),
        ...(financeView ? { finance: financeView } : {}),
      });
      if (!verification.ok) return verification;
      const v = verification.value;
      claim.setVerification(v.result, v.detail, v.reasonCodes[0]);
      claim.setNumericAtoms(v.numericAtoms ?? assertion.numericAtoms);
      const prior = resolvedByFingerprint.get(claim.fingerprint);
      if (prior) {
        claim.preserveResolution(prior.by, prior.notes, prior.excluded);
      }
      persisted.push(claim);
    }

    const cleared = await this.claims.deleteBySection(section.id, tenantId);
    if (!cleared.ok) return cleared;
    for (const claim of persisted) {
      const saved = await this.claims.create(claim);
      if (!saved.ok) return saved;
    }

    // P0-1 — For coverage/blocking purposes a resolved claim is satisfied
    // (accepted-with-limitation / excluded). The persisted claim keeps its
    // FAILED verification result plus its recorded decision; only the coverage
    // projection treats it as non-blocking.
    const coverageInput = persisted.map((c) => ({
      materiality: c.materiality ?? "MATERIAL",
      verificationResult: c.resolvedById !== undefined ? "ACCEPTED_WITH_LIMITATION" : c.verificationResult,
      verificationReasonCode: c.verificationReasonCode,
      type: c.type,
      text: c.text,
    }));
    const coverage = computeCoverageMetrics(coverageInput, { requireCurrentVerification: true });
    const blocked = !coverage.complete;

    try {
      if (revision.assuranceState === "UNASSESSED") revision.markAssessing();
      if (blocked) {
        revision.markFailed();
      } else {
        // P0-1 — A FAILED revision must pass through ASSESSING before CURRENT;
        // reconciliation (all blocking claims now resolved) promotes it so the
        // section can be approved.
        if (revision.assuranceState === "FAILED") revision.markAssessing();
        revision.markCurrent();
      }
    } catch (error) {
      return { ok: false, error: DomainError.invariant(String(error instanceof Error ? error.message : error)) };
    }
    const revisionSaved = await this.revisions.update(revision);
    if (!revisionSaved.ok) return revisionSaved;

    if (blocked) {
      section.markNeedsReview();
      await this.sections.update(section);
      if (this.projector) {
        const gaps = persisted
          .filter((c) => (c.materiality ?? "MATERIAL") === "MATERIAL" && c.verificationResult === "FAILED" && c.resolvedById === undefined)
          .map((c) => ({
            key: c.text,
            title: `Unsupported claim: ${c.text.slice(0, 80)}`,
            description: `This statement could not be confirmed: ${plainVerificationReason(c.verificationReasonCode)}. Resolve it, exclude it, or accept it with a limitation.`,
          }));
        const projected = await this.projector.project({
          tenantId,
          periodId: draft.reportingPeriodId,
          projectId: draft.projectId,
          gaps,
        });
        if (!projected.ok) return { ok: false, error: projected.error };
      }
    }

    // Items projected from earlier versions or earlier wording no longer describe a failing statement: close them.
    if (this.projector) {
      const everyClaim = await this.claims.findByDraft(draft.id, tenantId);
      if (everyClaim.ok) {
        const activeKeys = everyClaim.value
          .filter((c) => (c.materiality ?? "MATERIAL") === "MATERIAL" && c.verificationResult === "FAILED" && c.resolvedById === undefined)
          .map((c) => c.text);
        const reconciled = await this.projector.reconcile({ tenantId, periodId: draft.reportingPeriodId, activeKeys });
        if (!reconciled.ok) return { ok: false, error: reconciled.error };
      }
    }

    return {
      ok: true,
      value: {
        revisionId: revision.id,
        assuranceState: revision.assuranceState,
        claims: persisted,
        coverage: {
          totalAssertions: coverage.totalAssertions,
          materialAssertions: coverage.materialAssertions,
          complete: coverage.complete,
          blockingReasons: coverage.blockingReasons,
        },
        blocked,
        blockReasons: coverage.blockingReasons,
      },
    };
  }
}
