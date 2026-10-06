import { VERIFICATION_REASON_PLAIN, plainVerificationReason } from "@donordesk/domain/contexts/reporting/verification-reason.js";
/**
 * Plain-language copy for the reporting workspace.
 *
 * Every user-facing string that describes an AI fallback, a verification
 * outcome or a verification reason comes from here, so internal codes, env
 * var names, host names and model ids never reach NGO users. Pure module (no
 * imports) so it is unit-testable with `node --test`.
 */

const FALLBACK_REASON_COPY: Record<string, string> = {
  AI_REPORTER_DISABLED: "AI writing is switched off for this workspace, so a basic version was used.",
  PROVIDER_NOT_CONFIGURED: "AI writing is not set up for your organisation, so a basic version was used.",
  PROVIDER_TIMEOUT: "The AI service took too long for this section, so a basic version was used. Try again.",
  PROVIDER_EMPTY_RESPONSE: "The AI service returned no text for this section, so a basic version was used.",
  PROVIDER_MALFORMED_RESPONSE: "The AI service returned text we could not use, so a basic version was used.",
  PROVIDER_HTTP_ERROR: "The AI service could not be reached, so a basic version was used. Try again later.",
  PII_REJECTED: "The AI service refused this request because of personal data, so a basic version was used.",
  VALIDATOR_FAILED: "The AI text did not pass our fact checks, so a basic version was used.",
};

/** Explains why a section fell back to non-AI text. */
export function fallbackReasonCopy(reason: string | undefined | null): string {
  if (reason && FALLBACK_REASON_COPY[reason]) return FALLBACK_REASON_COPY[reason]!;
  return "The AI service was unavailable, so a basic version was used.";
}

/** Status line shown after a (non-background) draft generation completes. */
export function draftGeneratedCopy(input: { sectionCount: number; fallbackUsed: boolean; fallbackReason?: string | null }): string {
  const base = `Draft created with ${input.sectionCount} section${input.sectionCount === 1 ? "" : "s"}.`;
  return input.fallbackUsed ? `${base} ${fallbackReasonCopy(input.fallbackReason)}` : base;
}

const VERIFICATION_RESULT_COPY: Record<string, string> = {
  PASSED: "Matches evidence",
  FAILED: "Not supported by evidence",
  ACCEPTED_WITH_LIMITATION: "Kept with a note",
  EXCLUDED: "Left out of the report",
};

/** Short label for a claim's verification result. */
export function verificationResultCopy(result: string): string {
  return VERIFICATION_RESULT_COPY[result] ?? "Not checked yet";
}

/** The plain-language reasons live in the domain, so the checklist and this screen can never explain one differently. */
const REASON_COPY: Record<string, string> = VERIFICATION_REASON_PLAIN;

/** Plain-language explanation for one verification reason code. */
export function verificationReasonCopy(code: string): string {
  return plainVerificationReason(code);
}

const CODE_RE = /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/g;

/**
 * Rewrites the verifier's technical detail ("Numeric assertion failed:
 * VALUE_MISMATCH, UNIT_MISMATCH.") into a sentence a programme officer can act
 * on. Known reason codes become phrases; unknown UPPER_SNAKE tokens are
 * lower-cased so no raw enum survives.
 */
export function verificationDetailCopy(detail: string | undefined | null): string {
  const text = (detail ?? "").trim();
  if (!text) return "";
  const codes = Array.from(new Set(text.match(CODE_RE) ?? [])).filter((c) => REASON_COPY[c]);
  if (codes.length > 0) {
    const reasons = codes.map(verificationReasonCopy);
    const subject = /numeric|figure|number/i.test(text) ? "This figure" : "This statement";
    return `${subject} could not be confirmed: ${reasons.join("; ")}.`;
  }
  if (/^numeric assertion matches verified finding/i.test(text)) return "This figure matches the verified indicator data.";
  return text
    .replace(/numeric assertion/gi, "figure")
    .replace(CODE_RE, (code) => (REASON_COPY[code] ? verificationReasonCopy(code) : code.toLowerCase().replace(/_/g, " ")));
}

/**
 * A human label for a statement's evidence source: the evidence title from the
 * section's source references when known, never a raw id.
 */
export function evidenceLabelCopy(
  evidenceId: string,
  sourceReferences: ReadonlyArray<{ type: string; id: string; label?: string }> | undefined,
): string {
  const match = sourceReferences?.find((r) => r.id === evidenceId && r.label);
  return match?.label ?? "Evidence file";
}

export type FlagClassName = "REPORT_ERROR" | "NEEDS_DECISION" | "UNCONFIRMED";

const FLAG_CLASS_COPY: Record<FlagClassName, { title: string; hint: string }> = {
  REPORT_ERROR: {
    title: "Needs fixing",
    hint: "A figure in the report does not match your verified data or evidence. Correct the text or the data.",
  },
  NEEDS_DECISION: {
    title: "Needs your decision",
    hint: "Something about the evidence or its confidentiality needs a person to decide.",
  },
  UNCONFIRMED: {
    title: "We could not confirm",
    hint: "Interpretive statements our checker could not tie to a source. They are not necessarily wrong: read them, then accept them with one note.",
  },
};

/** Heading and one-line explanation for a flag class; unknown classes read as a decision, never as a checker limit. */
export function flagClassCopy(flagClass: string | undefined | null): { title: string; hint: string } {
  return FLAG_CLASS_COPY[(flagClass as FlagClassName) ?? "NEEDS_DECISION"] ?? FLAG_CLASS_COPY.NEEDS_DECISION;
}
