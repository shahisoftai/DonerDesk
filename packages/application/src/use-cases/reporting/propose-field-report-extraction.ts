import type { Result } from "@donordesk/domain";
import { DomainError, proposeFieldReportExtraction, type FieldReportExtraction } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";

/**
 * Increment 5 — Field report → proposed inputs (step 1, no write).
 *
 * Runs the conservative deterministic extractor over a field report's text and
 * returns PROPOSED structured inputs. Nothing is persisted here and nothing is
 * invented: the user reviews/edits these and confirms before they are saved.
 * The proposal is deliberately separate from ApplyFieldReportExtractionHandler
 * so extraction and persistence can never silently happen together.
 */
export class ProposeFieldReportExtractionHandler {
  async handle(ctx: AuthenticatedContext, text: string): Promise<Result<FieldReportExtraction, DomainError>> {
    if (!text || !text.trim()) {
      return { ok: false, error: DomainError.validation("No text to extract from.") };
    }
    return { ok: true, value: proposeFieldReportExtraction(text) };
  }
}
