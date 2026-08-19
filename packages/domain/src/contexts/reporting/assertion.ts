import type { VerificationReasonCode } from "./verification-reason.js";
import type { NumericAtom } from "./numeric-atom.js";

/**
 * Product-level assertion types. These extend the legacy ClaimType surface
 * (NUMERIC/FACTUAL/CAUSAL/QUALITATIVE) with forecast, recommendation, and
 * compliance declarations so the assurance pipeline can classify every
 * material statement in a revision.
 */
export type AssertionType =
  | "NUMERIC"
  | "FACTUAL"
  | "QUALITATIVE"
  | "CAUSAL"
  | "FORECAST"
  | "RECOMMENDATION"
  | "COMPLIANCE_DECLARATION";

export const ASSERTION_TYPES: AssertionType[] = [
  "NUMERIC",
  "FACTUAL",
  "QUALITATIVE",
  "CAUSAL",
  "FORECAST",
  "RECOMMENDATION",
  "COMPLIANCE_DECLARATION",
];

export type Materiality = "MATERIAL" | "NOT_MATERIAL";

export type ExtractionOrigin = "DETERMINISTIC" | "LLM" | "WRITER";

export interface AssertionSource {
  evidenceId: string;
  chunkId: string;
  sourceText: string;
}

/**
 * A structured assertion bound to an exact span of a report revision. The
 * writer-provided claim array is reconciled against these extracted
 * assertions; nothing that appears in the final content can silently bypass
 * the assurance pipeline.
 */
export interface Assertion {
  /** Stable fingerprint (FNV-1a of normalized text). Dedup key. */
  id: string;
  text: string;
  type: AssertionType;
  charStart: number;
  charEnd: number;
  materiality: Materiality;
  numericAtoms: NumericAtom[];
  sources: AssertionSource[];
  extractionOrigin: ExtractionOrigin;
  verificationReasonCode?: VerificationReasonCode;
  verificationResult?: string;
}

/**
 * Deterministic FNV-1a 32-bit hash. Domain must stay dependency-free, so
 * fingerprints and dedup keys use this stable non-cryptographic hash. Content
 * integrity (tamper detection) uses SHA-256 in infrastructure.
 */
export function stableFingerprint(text: string): string {
  let hash = 0x811c9dc5;
  const normalized = text.replace(/\s+/g, " ").trim().toLowerCase();
  for (let i = 0; i < normalized.length; i++) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `fp-${hash.toString(16).padStart(8, "0")}`;
}

/**
 * Materiality rules. Only numeric, causal, and compliance-declaration
 * assertions (which include safeguarding, incident, budget,
 * target-performance, and donor-commitment statements) are material by
 * default. Factual, recommendation, forecast, and qualitative description are
 * material only when they carry a numeric atom. Extractors that detect a
 * material subcategory must classify the assertion as a
 * COMPLIANCE_DECLARATION so it stays material.
 */
export function defaultMaterialityFor(type: AssertionType, hasNumericAtoms: boolean): Materiality {
  switch (type) {
    case "NUMERIC":
    case "CAUSAL":
    case "COMPLIANCE_DECLARATION":
      return "MATERIAL";
    case "FACTUAL":
    case "QUALITATIVE":
    case "FORECAST":
    case "RECOMMENDATION":
      return hasNumericAtoms ? "MATERIAL" : "NOT_MATERIAL";
  }
}

export interface CoverageMetrics {
  totalAssertions: number;
  materialAssertions: number;
  assessedAssertions: number;
  currentAssertions: number;
  materialAssessedRatio: number;
  /** True when every material assertion is registered, assessed, and current. */
  complete: boolean;
  blockingReasons: string[];
}

export function computeCoverageMetrics(
  assertions: Array<Pick<Assertion, "materiality" | "verificationResult" | "verificationReasonCode" | "type" | "text">>,
  opts?: { requireCurrentVerification?: boolean },
): CoverageMetrics {
  const totalAssertions = assertions.length;
  const materialAssertions = assertions.filter((a) => a.materiality === "MATERIAL").length;
  const assessedAssertions = assertions.filter((a) => a.verificationResult !== undefined && a.verificationResult !== "UNASSESSED").length;
  const currentAssertions = assertions.filter((a) => a.verificationResult === "PASSED" || a.verificationResult === "ACCEPTED_WITH_LIMITATION" || a.verificationResult === "EXCLUDED").length;
  const blockingReasons: string[] = [];

  for (const a of assertions) {
    if (a.materiality !== "MATERIAL") continue;
    if (a.verificationResult === undefined || a.verificationResult === "UNASSESSED") {
      blockingReasons.push(`Material assertion not assessed: ${a.text.slice(0, 80)}`);
    } else if (opts?.requireCurrentVerification && a.verificationResult === "FAILED") {
      blockingReasons.push(`Material assertion failed verification: ${a.text.slice(0, 80)}`);
    }
  }

  return {
    totalAssertions,
    materialAssertions,
    assessedAssertions,
    currentAssertions,
    materialAssessedRatio: materialAssertions === 0 ? 1 : assessedAssertions / materialAssertions,
    complete: blockingReasons.length === 0,
    blockingReasons,
  };
}
