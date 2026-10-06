/**
 * Why a section was not written by the AI, and what the user can do about it. The reason is stored on the section
 * (`ReportSection.generationFallbackReason`) so the editor never has to guess; the detail is short, user-safe text.
 */
export const GENERATION_FALLBACK_REASONS = [
  "AI_REPORTER_DISABLED",
  "PROVIDER_NOT_CONFIGURED",
  "PROVIDER_TIMEOUT",
  "PROVIDER_EMPTY_RESPONSE",
  "PROVIDER_MALFORMED_RESPONSE",
  "PROVIDER_HTTP_ERROR",
  "PII_REJECTED",
  "VALIDATOR_FAILED",
] as const;
export type GenerationFallbackReason = (typeof GENERATION_FALLBACK_REASONS)[number];

export interface GenerationFallback {
  reason: GenerationFallbackReason;
  /** Short and user-safe, e.g. "figure not in your data: 33.3%"; never a raw issue string. */
  detail?: string;
}

export function isGenerationFallbackReason(value: unknown): value is GenerationFallbackReason {
  return typeof value === "string" && (GENERATION_FALLBACK_REASONS as readonly string[]).includes(value);
}

/** What the banner offers: retry as it was, retry telling the writer to use recorded figures only, or go to settings. */
export type FallbackAction = "RETRY" | "RETRY_RECORDED_FIGURES_ONLY" | "OPEN_SETTINGS";

/** Exhaustive: a new reason cannot be added without choosing its action. */
export const FALLBACK_ACTION: Readonly<Record<GenerationFallbackReason, FallbackAction>> = {
  AI_REPORTER_DISABLED: "OPEN_SETTINGS",
  PROVIDER_NOT_CONFIGURED: "OPEN_SETTINGS",
  PROVIDER_TIMEOUT: "RETRY",
  PROVIDER_EMPTY_RESPONSE: "RETRY",
  PROVIDER_MALFORMED_RESPONSE: "RETRY",
  PROVIDER_HTTP_ERROR: "RETRY",
  PII_REJECTED: "RETRY",
  VALIDATOR_FAILED: "RETRY_RECORDED_FIGURES_ONLY",
};

/** The standing instruction behind "Try again, quote recorded figures only". */
export const RECORDED_FIGURES_ONLY_INSTRUCTION =
  "Quote only figures that appear in the recorded inputs, and the percent of target where one is given. Do not add totals, cumulative figures, percentages or counts of your own.";

/** Figures the validator rejected, read from its issue strings ("UNGROUNDED_NUMBER: 33.3, 26.2 do not appear ..."). */
export function ungroundedFiguresFromIssues(issues: readonly string[]): string[] {
  const figures: string[] = [];
  for (const issue of issues) {
    const match = /^UNGROUNDED_NUMBER:\s*(.+?)\s+do(?:es)? not appear/i.exec(issue.trim());
    if (!match) continue;
    for (const part of match[1]!.split(",")) {
      const figure = part.trim();
      if (figure && !figures.includes(figure)) figures.push(figure);
    }
  }
  return figures;
}

/** True when the validator found an id, uuid or file name in the prose (`INTERNAL_ID: ...`). */
export function hasInternalIdIssue(issues: readonly string[]): boolean {
  return issues.some((issue) => issue.trim().startsWith("INTERNAL_ID"));
}

export const NO_INTERNAL_IDS_INSTRUCTION = "Never write an evidence id, record id or file name: describe each source in words.";

const MAX_SHOWN_FIGURES = 4;

/** User-safe detail for a rejected draft: names the figures, never the validator's wording. */
export function fallbackDetailFromIssues(issues: readonly string[]): string | undefined {
  const figures = ungroundedFiguresFromIssues(issues);
  if (figures.length === 0) return hasInternalIdIssue(issues) ? "the text named an internal id or file name" : undefined;
  const shown = figures.slice(0, MAX_SHOWN_FIGURES).join(", ");
  return `${figures.length === 1 ? "figure" : "figures"} not in your data: ${shown}${figures.length > MAX_SHOWN_FIGURES ? " and more" : ""}`;
}

/** The instruction for the automatic retry after a rejected figure: names what not to state and what is allowed. */
export function recoveryInstruction(figures: readonly string[], existing?: string, options: { internalIds?: boolean } = {}): string {
  const named = figures.length > 0 ? `Do not state ${figures.slice(0, 8).join(", ")}. ` : "";
  const ids = options.internalIds ? `${NO_INTERNAL_IDS_INSTRUCTION} ` : "";
  const text = `${named}${ids}${RECORDED_FIGURES_ONLY_INSTRUCTION}`;
  const author = existing?.trim();
  return author ? `${author}\n\n${text}` : text;
}

/** Failures worth one automatic retry with a shorter brief: the provider did not answer in time or at all. */
export function isTransientFallback(reason: GenerationFallbackReason | undefined): boolean {
  return reason === "PROVIDER_TIMEOUT" || reason === "PROVIDER_HTTP_ERROR" || reason === "PROVIDER_EMPTY_RESPONSE";
}
