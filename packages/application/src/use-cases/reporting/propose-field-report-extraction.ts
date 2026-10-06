import type { Result } from "@donordesk/domain";
import { DomainError, complianceSectionsOf, proposeFieldReportExtraction, type FieldReportExtraction } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { ReportGenerationContextBuilder } from "../../services/report-generation-context.js";

/**
 * Increment 5 - Field report -> proposed inputs (step 1, no write).
 *
 * Runs the conservative deterministic extractor over a field report's text and
 * returns PROPOSED structured inputs. Nothing is persisted here and nothing is
 * invented: the user reviews/edits these and confirms before they are saved.
 * When the period's donor template has compliance sections, the text under each
 * section's own heading is proposed as that section's statement. The proposal is
 * deliberately separate from ApplyFieldReportExtractionHandler so extraction and
 * persistence can never silently happen together.
 */
export class ProposeFieldReportExtractionHandler {
  constructor(private readonly context?: Pick<ReportGenerationContextBuilder, "loadBase">) {}

  async handle(ctx: AuthenticatedContext, text: string, reportingPeriodId?: string): Promise<Result<FieldReportExtraction, DomainError>> {
    if (!text || !text.trim()) {
      return { ok: false, error: DomainError.validation("No text to extract from.") };
    }
    let sections: Array<{ key: string; title: string }> = [];
    if (this.context && reportingPeriodId) {
      const base = await this.context.loadBase(ctx, reportingPeriodId, "pinned");
      if (base.ok) sections = complianceSectionsOf(base.value.templateSections);
    }
    return { ok: true, value: proposeFieldReportExtraction(text, sections) };
  }
}
