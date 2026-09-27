import type { ILogger, ITemplateExtractionService, TemplateExtractionRequest, TemplateExtractionResult } from "@donordesk/application";
import { DomainError, type Result } from "@donordesk/domain";

/**
 * Tries each extractor in order (e.g. LLM, then heuristic). A later extractor's
 * result records why earlier ones were skipped, so a fallback is never silent.
 */
export class FallbackTemplateExtractionService implements ITemplateExtractionService {
  constructor(private readonly chain: ReadonlyArray<{ name: string; extractor: ITemplateExtractionService }>, private readonly logger?: ILogger) {}

  async extract(request: TemplateExtractionRequest): Promise<Result<TemplateExtractionResult, DomainError>> {
    const notes: string[] = [];
    for (const { name, extractor } of this.chain) {
      let result: Result<TemplateExtractionResult, DomainError>;
      try {
        result = await extractor.extract(request);
      } catch (error) {
        result = { ok: false, error: DomainError.invariant(error instanceof Error ? error.message : String(error)) };
      }
      if (result.ok) {
        return { ok: true, value: { ...result.value, meta: { ...result.value.meta, warnings: [...notes, ...result.value.meta.warnings] } } };
      }
      notes.push(`${name} extraction unavailable: ${result.error.message}`);
      this.logger?.warn("Template extractor failed; trying next", { extractor: name, error: result.error.message });
    }
    return { ok: false, error: DomainError.invariant(notes.join(" ") || "No template extractor configured") };
  }
}
