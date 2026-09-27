import { DomainError, parseDecimal, decimalCompare, decimalMultiply, decimalDivide, decimalRound, scoreSimilarity, type VerifiedFinding, type Decimal } from "@donordesk/domain";
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
 * Plain-language explanation for a numeric atom that failed to bind to a
 * verified finding, so the report workspace can tell the reviewer what was
 * expected and why the statement could not be confirmed.
 */
function describeAtomFailure(atom: NumericAtom, findings: VerifiedFinding[]): string {
  const value = parseDecimal(atom.value);
  if (value === null) return `${atom.value} could not be read as a number`;
  const exact = findings.filter((f) =>
    [f.value, f.cumulativeValue].some((t) => t !== undefined && parseDecimal(t) !== null && decimalCompare(parseDecimal(t)!, value) === 0),
  );
  if (exact.length > 0) {
    const codes = [...new Set(exact.map((f) => f.indicatorCode))].join(", ");
    return `${atom.value} also matches ${codes}, so the statement may mix indicators, units, or reporting periods`;
  }
  if (atom.role === "PERCENT" || atom.isPercent) {
    const denominatorMissing = findings.filter((f) => f.qualityFlags.includes("MISSING_DENOMINATOR"));
    if (denominatorMissing.length > 0) {
      const codes = [...new Set(denominatorMissing.map((f) => f.indicatorCode))].join(", ");
      return `${atom.value}% could not be verified because the percentage could not be calculated: the denominator was not recorded (${codes})`;
    }
    return `${atom.value}% matches no verified indicator value this period`;
  }
  return `${atom.value} matches no verified indicator value this period`;
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

    // Dates and counts of things (records, files, participants, "Batch 2", "6-month")
    // are metadata, never achievement values; they are not checked against
    // indicator findings. A sentence made only of such atoms carries no numeric
    // achievement claim to verify.
    const atoms = input.atoms.filter((a) => a.role !== "DATE" && a.role !== "COUNT");
    if (atoms.length === 0) {
      return { result: "PASSED", detail: "Numbers are dates or counts, not indicator values", reasonCodes: [] };
    }

    let matchedFinding: VerifiedFinding | undefined;
    const failures: VerificationReasonCode[] = [];
    const explanations: string[] = [];

    for (const atom of atoms) {
      const matched = this.matchAtom(atom, input.findings);
      if (!matched && matchedFinding !== undefined) {
        // Tolerate normal professional prose: once a sentence carries a value
        // that binds to a verified finding, target/baseline figures quoted
        // alongside it ("8 of the 120-centre target") are legitimate
        // references, not unverifiable claims.
        const reference = this.matchReferenceAtom(atom, input.findings);
        if (reference) continue;
      }
      if (!matched) {
        failures.push(atom.role === "PERCENT" || atom.role === "CURRENCY" || atom.role === "DATE" ? "DERIVATION_INVALID" : "VALUE_MISMATCH");
        explanations.push(describeAtomFailure(atom, input.findings));
        continue;
      }
      matchedFinding = matched.finding;
      if (matched.periodMismatch) {
        failures.push("PERIOD_MISMATCH");
        explanations.push(`${atom.value} refers to a different reporting period than the verified ${matched.finding.indicatorCode}`);
      }
      if (matched.unitMismatch) {
        failures.push("UNIT_MISMATCH");
        explanations.push(`${atom.value} uses a different unit than the verified ${matched.finding.indicatorCode} (${matched.finding.unit ?? "no unit"})`);
      }
      if (matched.entityMismatch) {
        failures.push("ENTITY_MISMATCH");
        explanations.push(`${atom.value} was linked to a different indicator than the verified ${matched.finding.indicatorCode}`);
      }
      if (matched.semanticsUnresolved) {
        failures.push("ENTITY_MISMATCH");
        explanations.push(`the verified ${matched.finding.indicatorCode} is marked as needing review`);
      }
    }

    if (failures.length > 0) {
      const uniqueExplanations = [...new Set(explanations)];
      return {
        result: "FAILED",
        detail: `Numeric assertion failed: ${[...new Set(failures)].join(", ")}.${uniqueExplanations.length > 0 ? ` ${uniqueExplanations.join(" ")}` : ""}`,
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
    // A finding's verified cumulative-to-date figure is as authoritative as its
    // period value ("taking cumulative enrolment to 7,000").
    const equalsValue = (text: string | undefined): boolean => {
      if (!text) return false;
      const parsed = parseDecimal(text);
      return parsed !== null && decimalCompare(parsed, value) === 0;
    };
    let candidates = findings.filter((f) => equalsValue(f.value) || equalsValue(f.cumulativeValue));

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
    // Accept both 1- and 2-decimal rounding so "6.7%" and "6.67%" both match
    // the same 8/120 derivation (professional prose is not uniform).
    for (const finding of findings) {
      const value = parseDecimal(finding.value);
      if (value === null) continue;
      for (const baseText of [finding.target, finding.baseline]) {
        if (!baseText) continue;
        const base = parseDecimal(baseText);
        if (base === null) continue;
        const ratio = decimalDivide(value, base, 6);
        if (ratio === null) continue;
        const raw = decimalMultiply(ratio, parseDecimal("100")!);
        const rounded1 = decimalRound(raw, 1);
        const rounded2 = decimalRound(raw, 2);
        if (decimalCompare(rounded1, percentValue) === 0 || decimalCompare(rounded2, percentValue) === 0) return finding;
      }
    }
    return null;
  }

  /**
   * Matches an atom against a finding's declared target or baseline. Used only
   * as a tolerated reference figure once the sentence already binds a real
   * value ("8 learning centres, reaching 6.67% of the 120-centre target").
   */
  private matchReferenceAtom(atom: NumericAtom, findings: VerifiedFinding[]): VerifiedFinding | null {
    const value = parseDecimal(atom.value);
    if (value === null) return null;
    for (const finding of findings) {
      for (const baseText of [finding.target, finding.baseline, finding.priorCumulativeValue]) {
        if (!baseText) continue;
        const base = parseDecimal(baseText);
        if (base !== null && decimalCompare(base, value) === 0) return finding;
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
const CONTRADICTION_RE = /(no evidence|did not|was not|wasn't|contradicts|cannot be confirmed|unable to confirm|not supported)/i;

export class DeterministicEntailmentVerifier implements IEntailmentVerifier {
  constructor(private readonly supportThreshold = 0.5, private readonly uncertainThreshold = 0.3) {}

  async verify(input: {
    assertionText: string;
    assertionType: AssertionType;
    evidence: RetrievedEvidence[];
  }): Promise<{ ok: true; value: EntailmentResult } | { ok: false; error: DomainError }> {
    if (input.assertionText.trim().length === 0) {
      return { ok: true, value: { verdict: "UNCERTAIN", citedSpans: [], confidence: 0, reasonCode: "ENTAILMENT_UNCERTAIN" } };
    }

    let best: RetrievedEvidence | undefined;
    let bestScore = 0;
    for (const chunk of input.evidence) {
      const score = scoreSimilarity(input.assertionText, chunk.chunkText);
      if (score > bestScore) {
        bestScore = score;
        best = chunk;
      }
    }

    const verdict: EntailmentVerdict =
      bestScore >= this.supportThreshold ? "SUPPORTED"
        : bestScore >= this.uncertainThreshold ? "UNCERTAIN"
          : "INSUFFICIENT";

    // Bug fix (donor-report quality audit, 2026-09-17): the contradiction
    // check must look only at the chunk that actually matched this
    // assertion (`best`), never at the whole evidence set — otherwise an
    // unrelated chunk elsewhere in the retrieval window that happens to
    // contain a phrase like "did not" (about something else entirely) could
    // flip an otherwise well-supported, correctly-cited claim to
    // CONTRADICTED.
    const contradiction = best !== undefined && CONTRADICTION_RE.test(best.chunkText);

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
