/**
 * The one extractor implementation (Phase 36.2): it runs an `AreaExtractionSpec` through the shared machinery. Every area
 * is the same class with a different spec (composition, no base class), so the LSP contract holds for all of them by
 * construction and is still tested per area (`setup-extractor-contract`).
 */
import type { DomainError, Result, SetupAreaKey } from "@donordesk/domain";
import type { ExtractedArea, ISetupAreaExtractor, ISetupLlm, SetupExtractInput } from "@donordesk/application";
import type { AreaExtractionSpec } from "./area-spec.js";
import { runAreaExtraction } from "./extractor-shared.js";
import { BLOCKS_HEADER, SETUP_SYSTEM_RULES } from "./prompts/rules.js";

export class PromptedAreaExtractor implements ISetupAreaExtractor {
  readonly area: SetupAreaKey;

  constructor(private readonly spec: AreaExtractionSpec, private readonly llm: ISetupLlm) {
    this.area = spec.area;
  }

  async extract(input: SetupExtractInput): Promise<Result<ExtractedArea, DomainError>> {
    const spec = this.spec;
    const run = await runAreaExtraction({
      llm: this.llm,
      tenantId: input.tenantId,
      proposalId: input.proposalId,
      blocks: input.blocks,
      sourceText: input.sourceText,
      prior: input.prior,
      maxTokens: spec.maxTokens ?? input.maxTokens,
      timeoutMs: input.timeoutMs,
      keywords: spec.keywords,
      budgetChars: spec.budgetChars,
      headBlocks: spec.headBlocks,
      buildPrompt: (blocksText, prior) => ({
        system: SETUP_SYSTEM_RULES,
        user: [spec.instructions, spec.context ? spec.context(prior) : "", BLOCKS_HEADER, blocksText].filter(Boolean).join("\n\n"),
      }),
      parseChunk: spec.parse,
      merge: spec.merge,
    });
    if (!run.ok) return run;
    // The prompt that produced the answer is named by the spec, so an eval or an audit row can say which one it measured.
    return { ok: true, value: { ...run.value, promptVersion: spec.promptVersion } };
  }
}

export const createSetupExtractors = (specs: readonly AreaExtractionSpec[], llm: ISetupLlm): ISetupAreaExtractor[] =>
  specs.map((spec) => new PromptedAreaExtractor(spec, llm));
