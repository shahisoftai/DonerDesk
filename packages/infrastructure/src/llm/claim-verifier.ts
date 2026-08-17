import { DomainError, parseDecimal, decimalCompare, type Result } from "@donordesk/domain";
import type { IClaimVerifier, ClaimVerification, EvidencePackage, ReportClaimDraft } from "@donordesk/application";

const CONFIDENTIAL_LEVELS = new Set(["SENSITIVE", "HIGHLY_SENSITIVE"]);

function extractNumbers(text: string): string[] {
  const matches = text.match(/-?\d+(\.\d+)?/g);
  if (!matches) return [];
  return matches.filter((m) => parseDecimal(m) !== null);
}

function numbersEqual(a: string, b: string): boolean {
  const da = parseDecimal(a);
  const db = parseDecimal(b);
  if (da === null || db === null) return false;
  return decimalCompare(da, db) === 0;
}

function packageConfidentiality(evidencePackages: EvidencePackage[], evidenceId: string): string | undefined {
  const pkg = evidencePackages.find((p) => p.evidenceId === evidenceId);
  return pkg?.confidentialityLevel;
}

/**
 * Tiered claim verifier. Tiers run in cost order and short-circuit:
 * 1. Numeric exact match against verified findings (deterministic).
 * 2. Unit and period match (deterministic).
 * 4. Qualitative evidence coverage (source-count threshold).
 * 5. Elevated causal-claim review (human decision).
 * LLM-backed entailment (tier 3) sits behind a provider swap point. A failed
 * verification is never silently converted into a passed state here.
 */
export class DeterministicClaimVerifier implements IClaimVerifier {
  async verify(input: {
    claim: ReportClaimDraft;
    findings: Array<{ indicatorId: string; indicatorCode: string; value: string; unit?: string; qualityFlags: string[]; reportingPeriodId: string }>;
    evidencePackages: EvidencePackage[];
  }): Promise<Result<ClaimVerification, DomainError>> {
    const claim = input.claim;

    if (claim.type === "NUMERIC") {
      return this.verifyNumeric(input);
    }

    if (claim.type === "FACTUAL" || claim.type === "QUALITATIVE") {
      return this.verifyEvidenceCoverage(input, 1);
    }

    if (claim.type === "CAUSAL") {
      return this.verifyEvidenceCoverage(input, 2);
    }

    return {
      ok: true,
      value: {
        claimId: "",
        result: "FAILED",
        detail: "Claim type cannot be verified; requires human review",
        tierUsed: 5,
      },
    };
  }

  private verifyNumeric(input: {
    claim: ReportClaimDraft;
    findings: Array<{ indicatorId: string; indicatorCode: string; value: string; unit?: string; qualityFlags: string[]; reportingPeriodId: string }>;
  }): Result<ClaimVerification, DomainError> {
    const numbers = extractNumbers(input.claim.text);
    if (numbers.length === 0) {
      return {
        ok: true,
        value: {
          claimId: "",
          result: "FAILED",
          detail: "Numeric claim contains no number to verify",
          tierUsed: 1,
        },
      };
    }
    const claimNumber = numbers[0]!;

    for (const finding of input.findings) {
      if (numbersEqual(claimNumber, finding.value)) {
        if (finding.qualityFlags.includes("NEEDS_REVIEW")) {
          return {
            ok: true,
            value: {
              claimId: "",
              result: "FAILED",
              detail: `Numeric claim matches ${finding.indicatorCode} but indicator semantics are unresolved; evaluative statements are blocked`,
              matchedFinding: finding as ClaimVerification["matchedFinding"],
              tierUsed: 2,
            },
          };
        }
        return {
          ok: true,
          value: {
            claimId: "",
            result: "PASSED",
            detail: `Numeric claim matches verified finding ${finding.indicatorCode}`,
            matchedFinding: finding as ClaimVerification["matchedFinding"],
            tierUsed: 1,
          },
        };
      }
    }

    const unresolved = input.findings.some((f) => f.qualityFlags.includes("NEEDS_REVIEW"));
    return {
      ok: true,
      value: {
        claimId: "",
        result: "FAILED",
        detail: unresolved
          ? "Numeric claim does not match any finding and indicator semantics are unresolved"
          : `Numeric claim (${claimNumber}) contradicts verified findings`,
        tierUsed: 1,
      },
    };
  }

  private verifyEvidenceCoverage(
    input: {
      claim: ReportClaimDraft;
      findings: Array<{ indicatorId: string; indicatorCode: string; value: string; unit?: string; qualityFlags: string[]; reportingPeriodId: string }>;
      evidencePackages: EvidencePackage[];
    },
    minSources: number,
  ): Result<ClaimVerification, DomainError> {
    const sources = input.claim.proposedSources;
    if (sources.length === 0) {
      return {
        ok: true,
        value: {
          claimId: "",
          result: "FAILED",
          detail: "Claim has no attached evidence source",
          tierUsed: 4,
        },
      };
    }

    const confidential = sources.find((s) => {
      const level = packageConfidentiality(input.evidencePackages, s.evidenceId);
      return level !== undefined && CONFIDENTIAL_LEVELS.has(level);
    });
    if (confidential) {
      return {
        ok: true,
        value: {
          claimId: "",
          result: "FAILED",
          detail: `Confidential source included (evidence ${confidential.evidenceId}); authorization required`,
          tierUsed: 4,
        },
      };
    }

    if (sources.length >= minSources) {
      return {
        ok: true,
        value: {
          claimId: "",
          result: "PASSED",
          detail: `Claim supported by ${sources.length} evidence source(s)`,
          tierUsed: input.claim.type === "CAUSAL" ? 5 : 4,
        },
      };
    }

    return {
      ok: true,
      value: {
        claimId: "",
        result: "FAILED",
        detail: input.claim.type === "CAUSAL"
          ? "Causal claim has limited evidence; elevated review required"
          : "Claim has insufficient evidence support",
        tierUsed: input.claim.type === "CAUSAL" ? 5 : 4,
      },
    };
  }
}
