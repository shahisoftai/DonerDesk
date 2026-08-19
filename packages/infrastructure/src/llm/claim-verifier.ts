import { DomainError, extractNumericAtoms, classifyNumericAtomRoles, type VerifiedFinding, type VerificationReasonCode, type Result } from "@donordesk/domain";
import type { IClaimVerifier, ClaimVerification, EvidencePackage, ReportClaimDraft, EntailmentResult, IEvidenceIntegrityVerifier } from "@donordesk/application";
import { NumericAssertionVerifier, DeterministicEntailmentVerifier, CausalReviewPolicy } from "./verifier-strategies.js";
import { DeterministicEvidenceIntegrityVerifier } from "./evidence-integrity-verifier.js";

/**
 * Tiered claim verifier facade. Tiers run in cost order and short-circuit:
 * 1. Evidence integrity: cited sources must still match their snapshotted bytes.
 * 2. Numeric atom binding: every number is bound to indicator/unit/period/role.
 * 3. Deterministic entailment: cited chunks must actually support the assertion.
 * 4. Causal review policy: causality is never auto-approved.
 * A failed verification is never silently converted into a passed state here.
 */
export class DeterministicClaimVerifier implements IClaimVerifier {
  private readonly integrity: IEvidenceIntegrityVerifier;
  private readonly numeric: NumericAssertionVerifier;
  private readonly entailment: DeterministicEntailmentVerifier;
  private readonly causal: CausalReviewPolicy;

  constructor(options?: {
    integrity?: IEvidenceIntegrityVerifier;
    numeric?: NumericAssertionVerifier;
    entailment?: DeterministicEntailmentVerifier;
    causal?: CausalReviewPolicy;
  }) {
    this.integrity = options?.integrity ?? new DeterministicEvidenceIntegrityVerifier();
    this.numeric = options?.numeric ?? new NumericAssertionVerifier();
    this.entailment = options?.entailment ?? new DeterministicEntailmentVerifier();
    this.causal = options?.causal ?? new CausalReviewPolicy();
  }

  async verify(input: {
    claim: ReportClaimDraft;
    findings: VerifiedFinding[];
    evidencePackages: EvidencePackage[];
  }): Promise<Result<ClaimVerification, DomainError>> {
    const claim = input.claim;

    const integrity = await this.integrity.verify({
      sources: claim.proposedSources,
      evidencePackages: input.evidencePackages,
    });
    if (!integrity.ok) return integrity;
    const integrityBlockers = integrity.value.reasons.filter((r) => r !== "SOURCE_MISSING");
    if (integrityBlockers.length > 0) {
      return {
        ok: true,
        value: {
          claimId: "",
          result: "FAILED",
          detail: integrity.value.detail,
          reasonCodes: integrityBlockers as VerificationReasonCode[],
          tierUsed: 4,
        },
      };
    }

    switch (claim.type) {
      case "NUMERIC": {
        const atoms = classifyNumericAtomRoles(claim.text, extractNumericAtoms(claim.text));
        const result = this.numeric.verify({ atoms, findings: input.findings });
        return {
          ok: true,
          value: {
            claimId: "",
            result: result.result,
            detail: result.detail,
            matchedFinding: result.matchedFinding,
            tierUsed: result.result === "PASSED" ? 1 : 2,
            reasonCodes: result.reasonCodes,
            numericAtoms: atoms,
          },
        };
      }
      case "FACTUAL":
      case "QUALITATIVE": {
        const evidence = this.retrieveEvidence(claim, input.evidencePackages);
        const entailment = await this.entailment.verify({
          assertionText: claim.text,
          assertionType: claim.type,
          evidence,
        });
        if (!entailment.ok) return entailment;
        return this.entailmentResult(claim, entailment.value, 4);
      }
      case "CAUSAL": {
        const evidence = this.retrieveEvidence(claim, input.evidencePackages);
        const entailment = await this.entailment.verify({
          assertionText: claim.text,
          assertionType: claim.type,
          evidence,
        });
        if (!entailment.ok) return entailment;
        const requiresHuman = this.causal.requiresHumanDecision(claim.type, entailment.value.verdict);
        if (requiresHuman) {
          return {
            ok: true,
            value: {
              claimId: "",
              result: "FAILED",
              detail: "Causal claim requires an authorized human decision",
              tierUsed: 5,
              reasonCodes: [this.causal.reasonCode()],
              entailment: entailment.value,
            },
          };
        }
        return this.entailmentResult(claim, entailment.value, 5);
      }
      default:
        return {
          ok: true,
          value: {
            claimId: "",
            result: "FAILED",
            detail: "Claim type cannot be verified; requires human review",
            tierUsed: 5,
            reasonCodes: ["ENTAILMENT_UNCERTAIN"],
          },
        };
    }
  }

  private entailmentResult(
    claim: ReportClaimDraft,
    entailment: EntailmentResult,
    tier: 3 | 4 | 5,
  ): Result<ClaimVerification, DomainError> {
    switch (entailment.verdict) {
      case "SUPPORTED":
        return {
          ok: true,
          value: {
            claimId: "",
            result: "PASSED",
            detail: `Assertion supported by cited evidence (confidence ${Math.round(entailment.confidence * 100)}%)`,
            tierUsed: tier,
            reasonCodes: [],
            entailment,
          },
        };
      case "CONTRADICTED":
        return {
          ok: true,
          value: {
            claimId: "",
            result: "FAILED",
            detail: "Cited evidence contradicts the assertion",
            tierUsed: tier,
            reasonCodes: ["ENTAILMENT_FAILED"],
            entailment,
          },
        };
      case "UNCERTAIN":
        return {
          ok: true,
          value: {
            claimId: "",
            result: "FAILED",
            detail: "Evidence does not clearly support the assertion; manual review required",
            tierUsed: tier,
            reasonCodes: ["ENTAILMENT_UNCERTAIN"],
            entailment,
          },
        };
      case "INSUFFICIENT":
        return {
          ok: true,
          value: {
            claimId: "",
            result: "FAILED",
            detail: "Insufficient evidence support for the assertion",
            tierUsed: tier,
            reasonCodes: claim.proposedSources.length === 0 ? (["SOURCE_MISSING"] as VerificationReasonCode[]) : (["ENTAILMENT_FAILED"] as VerificationReasonCode[]),
            entailment,
          },
        };
    }
  }

  private retrieveEvidence(claim: ReportClaimDraft, packages: EvidencePackage[]) {
    const ranked = new Map<string, { evidenceId: string; chunkId: string; chunkText: string; score: number }>();
    const claimTokens = this.tokenize(claim.text);

    // Always include the writer's proposed sources (validated by integrity).
    for (const source of claim.proposedSources) {
      const pkg = packages.find((p) => p.evidenceId === source.evidenceId);
      if (!pkg) continue;
      const chunk = pkg.chunks.find((c) => c.chunkId === source.chunkId);
      const text = chunk?.text ?? source.sourceText;
      if (text) ranked.set(`${source.evidenceId}:${source.chunkId}`, { evidenceId: source.evidenceId, chunkId: source.chunkId, chunkText: text, score: 1 });
    }

    // Retrieve the most relevant chunks from the full evidence set so an
    // assertion is not limited to whatever the writer happened to cite, and
    // unrelated evidence cannot silently make a claim pass.
    for (const pkg of packages) {
      for (const chunk of pkg.chunks) {
        const key = `${pkg.evidenceId}:${chunk.chunkId}`;
        if (ranked.has(key)) continue;
        const chunkTokens = this.tokenize(chunk.text);
        let overlap = 0;
        for (const token of claimTokens) if (chunkTokens.has(token)) overlap++;
        const score = claimTokens.size === 0 ? 0 : overlap / claimTokens.size;
        if (score > 0) ranked.set(key, { evidenceId: pkg.evidenceId, chunkId: chunk.chunkId, chunkText: chunk.text, score });
      }
    }

    return [...ranked.values()].sort((a, b) => b.score - a.score).slice(0, 8);
  }

  private tokenize(text: string): Set<string> {
    return new Set(text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean));
  }
}
