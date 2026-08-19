import type {
  Result,
  TenantId,
  VerifiedFinding,
  ClaimSource,
} from "@donordesk/domain";
import { DomainError, ReportClaim, computeCoverageMetrics } from "@donordesk/domain";
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
  EvidencePackage,
  ReportClaimDraft,
} from "../ports/reporting.js";
import type { IIdGenerator } from "../ports/core.js";
import type { IUnsupportedClaimProjector } from "../ports/compliance.js";
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

    const writerClaims = input.writerClaims ?? [];
    const evidenceIds = new Set<string>();
    for (const c of writerClaims) {
      for (const s of c.proposedSources) evidenceIds.add(s.evidenceId);
    }
    let packages = input.evidencePackages;
    if (!packages) {
      const packagesResult = await this.evidencePackages.build({ tenantId, evidenceIds: [...evidenceIds] });
      if (!packagesResult.ok) return packagesResult;
      packages = packagesResult.value;
    }

    const extraction = await this.extractor.extract({ content: revision.content, writerClaims });
    if (!extraction.ok) return extraction;
    const assertions = extraction.value;

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
          proposedSources: assertion.sources,
        },
        findings,
        evidencePackages: packages,
      });
      if (!verification.ok) return verification;
      const v = verification.value;
      claim.setVerification(v.result, v.detail, v.reasonCodes[0]);
      claim.setNumericAtoms(v.numericAtoms ?? assertion.numericAtoms);
      persisted.push(claim);
    }

    const cleared = await this.claims.deleteBySection(section.id, tenantId);
    if (!cleared.ok) return cleared;
    for (const claim of persisted) {
      const saved = await this.claims.create(claim);
      if (!saved.ok) return saved;
    }

    const coverageInput = persisted.map((c) => ({
      materiality: c.materiality ?? "MATERIAL",
      verificationResult: c.verificationResult,
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
            description: `Material assertion failed verification (${c.verificationReasonCode ?? "UNASSESSED"}). Resolve, exclude, or accept with a limitation.`,
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
