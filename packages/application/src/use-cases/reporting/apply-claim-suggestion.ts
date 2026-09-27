import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IReportClaimRepository, IReportSectionRepository } from "../../ports/reporting.js";
import type { GetClaimSuggestionHandler } from "./get-claim-suggestion.js";
import type { UpdateReportSectionHandler } from "./update-report-section.js";

/**
 * Where a statement sits in its section's markdown: the verifier's span when
 * it still holds the statement, otherwise the first exact occurrence.
 */
export function locateClaimSpan(content: string, claim: { text: string; charStart?: number; charEnd?: number }): { start: number; end: number } | null {
  if (claim.charStart !== undefined && claim.charEnd !== undefined && content.slice(claim.charStart, claim.charEnd) === claim.text) {
    return { start: claim.charStart, end: claim.charEnd };
  }
  const index = content.indexOf(claim.text);
  return index >= 0 ? { start: index, end: index + claim.text.length } : null;
}

/** Replaces the first standalone `from` number inside [start, end). */
export function replaceNumberInSpan(content: string, span: { start: number; end: number }, from: string, to: string): string | null {
  const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(?<![\\d.,])${escaped}(?![\\d]|[.,]\\d)`);
  const slice = content.slice(span.start, span.end);
  const match = re.exec(slice);
  if (!match) return null;
  const at = span.start + match.index;
  return `${content.slice(0, at)}${to}${content.slice(at + from.length)}`;
}

/**
 * Report Editor B5 — "Use 11,860 from evidence": replaces the wrong number
 * in the statement with the evidence value and saves it through the normal
 * section update (new AUTO_FIX revision, re-verified at once). Server-side so
 * the replacement is computed against the stored text, never stale offsets.
 * The previous text is returned for the editor's undo.
 */
export class ApplyClaimSuggestionHandler {
  constructor(
    private readonly claims: IReportClaimRepository,
    private readonly sections: IReportSectionRepository,
    private readonly suggestions: GetClaimSuggestionHandler,
    private readonly updateSection: UpdateReportSectionHandler,
  ) {}

  async handle(ctx: AuthenticatedContext, claimId: string, expectedVersion?: string): Promise<Result<{ sectionId: string; version: string; previousContent: string }, DomainError>> {
    const suggestion = await this.suggestions.handle(ctx, claimId);
    if (!suggestion.ok) return suggestion;
    const replacement = suggestion.value.suggestion;
    if (!replacement) return { ok: false, error: DomainError.invalidTransition("There is no single evidence value to use for this statement.") };

    const claimResult = await this.claims.findById(claimId, ctx.tenant.tenantId);
    if (!claimResult.ok) return claimResult;
    const claim = claimResult.value;
    if (!claim) return { ok: false, error: DomainError.notFound("ReportClaim", claimId) };
    const sectionResult = await this.sections.findById(claim.sectionId, ctx.tenant.tenantId);
    if (!sectionResult.ok) return sectionResult;
    const section = sectionResult.value;
    if (!section) return { ok: false, error: DomainError.notFound("ReportSection", claim.sectionId) };

    const span = locateClaimSpan(section.content, claim);
    const content = span ? replaceNumberInSpan(section.content, span, replacement.from, replacement.to) : null;
    if (!content) {
      return { ok: false, error: DomainError.conflict("This statement's wording changed since it was checked. Re-check the section, then try again.") };
    }

    const updated = await this.updateSection.handle(ctx, section.id, {
      content,
      sourceReferences: section.sourceReferences,
      unsupportedClaims: section.unsupportedClaims,
      expectedVersion,
      changeOrigin: "AUTO_FIX",
    });
    if (!updated.ok) return updated;
    return { ok: true, value: { sectionId: section.id, version: updated.value.version, previousContent: section.content } };
  }
}
