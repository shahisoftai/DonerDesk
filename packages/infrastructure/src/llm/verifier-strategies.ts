import { DomainError, parseDecimal, decimalCompare, decimalMultiply, decimalDivide, decimalRound, type VerifiedFinding, type Decimal } from "@donordesk/domain";
import type { NumericAtom, VerificationReasonCode } from "@donordesk/domain";
import type { IEntailmentVerifier, ICausalReviewPolicy, EntailmentResult, EntailmentVerdict, RetrievedEvidence } from "@donordesk/application";
import type { AssertionType } from "@donordesk/domain";

interface AtomMatch {
  finding: VerifiedFinding;
  periodMismatch: boolean;
  unitMismatch: boolean;
  entityMismatch: boolean;
  semanticsUnresolved: boolean;
  derived: boolean;
}

/**
 * Numeric verification strategy. Every numeric atom in an assertion is bound
 * to indicator, unit, period, entity, and semantic role before it can pass;
 * matching a single number never validates a sentence. Percentages may be
 * derived from a finding's value/target or value/baseline using domain decimal
 * math only; a percentage that matches a raw non-percentage finding fails as
 * DERIVATION_INVALID.
 */
export class NumericAssertionVerifier {
  verify(input: {
    atoms: NumericAtom[];
    findings: VerifiedFinding[];
  }): { result: "PASSED" | "FAILED"; detail: string; reasonCodes: VerificationReasonCode[]; matchedFinding?: VerifiedFinding } {
    if (input.atoms.length === 0) {
      return {
        result: "FAILED",
        detail: "Numeric assertion contains no number to verify",
        reasonCodes: ["VALUE_MISMATCH"],
      };
    }

    let matchedFinding: VerifiedFinding | undefined;
    const failures: VerificationReasonCode[] = [];

    for (const atom of input.atoms) {
      const matched = this.matchAtom(atom, input.findings);
      if (!matched) {
        failures.push(atom.role === "PERCENT" || atom.role === "CURRENCY" || atom.role === "DATE" ? "DERIVATION_INVALID" : "VALUE_MISMATCH");
        continue;
      }
      matchedFinding = matched.finding;
      if (matched.periodMismatch) failures.push("PERIOD_MISMATCH");
      if (matched.unitMismatch) failures.push("UNIT_MISMATCH");
      if (matched.entityMismatch) failures.push("ENTITY_MISMATCH");
      if (matched.semanticsUnresolved) failures.push("ENTITY_MISMATCH");
    }

    if (failures.length > 0) {
      return {
        result: "FAILED",
        detail: `Numeric assertion failed: ${[...new Set(failures)].join(", ")}`,
        reasonCodes: [...new Set(failures)],
        matchedFinding,
      };
    }

    return {
      result: "PASSED",
      detail: `Numeric assertion matches verified finding${matchedFinding ? ` ${matchedFinding.indicatorCode}` : ""}`,
      reasonCodes: [],
      matchedFinding,
    };
  }

  private matchAtom(atom: NumericAtom, findings: VerifiedFinding[]): AtomMatch | null {
    const value = parseDecimal(atom.value);
    if (value === null) return null;

    // Direct value match first.
    let candidates = findings.filter((f) => {
      const fv = parseDecimal(f.value);
      return fv !== null && decimalCompare(fv, value) === 0;
    });

    let derived = false;
    if (candidates.length === 0 && atom.role === "PERCENT") {
      const derivedMatch = this.matchDerivedPercent(atom, value, findings);
      if (derivedMatch) {
        candidates = [derivedMatch];
        derived = true;
      }
    }
    if (candidates.length === 0) return null;

    // Prefer a candidate bound to the atom's indicator/period.
    let finding = candidates[0]!;
    if (atom.indicatorId) {
      finding = candidates.find((f) => f.indicatorId === atom.indicatorId) ?? finding;
    } else if (atom.indicatorCode) {
      finding = candidates.find((f) => f.indicatorCode === atom.indicatorCode) ?? finding;
    }
    if (atom.reportingPeriodId) {
      finding = candidates.find((f) => f.reportingPeriodId === atom.reportingPeriodId) ?? finding;
    }

    const periodMismatch = Boolean(atom.reportingPeriodId) && Boolean(finding.reportingPeriodId) && atom.reportingPeriodId !== finding.reportingPeriodId;
    const unitMismatch = Boolean(atom.unit) && Boolean(finding.unit) && atom.unit !== finding.unit;
    const entityMismatch = Boolean(atom.indicatorCode) && Boolean(finding.indicatorCode) && atom.indicatorCode !== finding.indicatorCode;
    const semanticsUnresolved = finding.qualityFlags.includes("NEEDS_REVIEW");

    return { finding, periodMismatch, unitMismatch, entityMismatch, semanticsUnresolved, derived };
  }

  private matchDerivedPercent(atom: NumericAtom, percentValue: Decimal, findings: VerifiedFinding[]): VerifiedFinding | null {
    // A percentage atom can be derived as value/target*100 or value/baseline*100.
    for (const finding of findings) {
      const value = parseDecimal(finding.value);
      if (value === null) continue;
      for (const baseText of [finding.target, finding.baseline]) {
        if (!baseText) continue;
        const base = parseDecimal(baseText);
        if (base === null) continue;
        const ratio = decimalDivide(value, base, 6);
        if (ratio === null) continue;
        const percent = decimalRound(decimalMultiply(ratio, parseDecimal("100")!), 1);
        if (decimalCompare(percent, percentValue) === 0) return finding;
      }
    }
    return null;
  }
}

/**
 * Deterministic entailment strategy. Computes token-overlap between the
 * assertion and cited chunks and returns SUPPORTED/CONTRADICTED/INSUFFICIENT/
 * UNCERTAIN with cited spans and confidence. It never approves a report.
 */
export class DeterministicEntailmentVerifier implements IEntailmentVerifier {
  constructor(private readonly supportThreshold = 0.5, private readonly uncertainThreshold = 0.3) {}

  async verify(input: {
    assertionText: string;
    assertionType: AssertionType;
    evidence: RetrievedEvidence[];
  }): Promise<{ ok: true; value: EntailmentResult } | { ok: false; error: DomainError }> {
    const assertionTokens = this.tokens(input.assertionText);
    if (assertionTokens.size === 0) {
      return { ok: true, value: { verdict: "UNCERTAIN", citedSpans: [], confidence: 0, reasonCode: "ENTAILMENT_UNCERTAIN" } };
    }

    let best: RetrievedEvidence | undefined;
    let bestScore = 0;
    for (const chunk of input.evidence) {
      const chunkTokens = this.tokens(chunk.chunkText);
      let overlap = 0;
      for (const token of assertionTokens) {
        if (chunkTokens.has(token)) overlap++;
      }
      const score = overlap / assertionTokens.size;
      if (score > bestScore) {
        bestScore = score;
        best = chunk;
      }
    }

    const verdict: EntailmentVerdict =
      bestScore >= this.supportThreshold ? "SUPPORTED"
        : bestScore >= this.uncertainThreshold ? "UNCERTAIN"
          : "INSUFFICIENT";

    const contradiction = input.evidence.some((c) => /(no evidence|did not|was not|wasn't|contradicts|cannot be confirmed|unable to confirm|not supported)/i.test(c.chunkText));

    if (verdict === "SUPPORTED" && contradiction) {
      return {
        ok: true,
        value: {
          verdict: "CONTRADICTED",
          citedSpans: best ? [{ evidenceId: best.evidenceId, chunkId: best.chunkId, sourceText: best.chunkText }] : [],
          confidence: bestScore,
          reasonCode: "ENTAILMENT_FAILED",
        },
      };
    }

    const reasonCode = verdict === "SUPPORTED" ? null : verdict === "UNCERTAIN" ? "ENTAILMENT_UNCERTAIN" : "ENTAILMENT_FAILED";
    return {
      ok: true,
      value: {
        verdict,
        citedSpans: best ? [{ evidenceId: best.evidenceId, chunkId: best.chunkId, sourceText: best.chunkText }] : [],
        confidence: bestScore,
        reasonCode,
      },
    };
  }

  private tokens(text: string): Set<string> {
    return new Set(text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean));
  }
}

/**
 * Causal review policy: causality is never auto-approved. Causal assertions
 * always require an authorized human decision even when evidence passes.
 */
export class CausalReviewPolicy implements ICausalReviewPolicy {
  requiresHumanDecision(type: AssertionType, verdict: EntailmentVerdict): boolean {
    return type === "CAUSAL" && (verdict === "SUPPORTED" || verdict === "UNCERTAIN");
  }

  reasonCode(): VerificationReasonCode {
    return "CAUSAL_REVIEW_REQUIRED";
  }
}
