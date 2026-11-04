import { withModel } from "./setup-llm.js";
/**
 * The one extractor implementation (Phase 36.2): it runs an `AreaExtractionSpec` through the shared machinery. Every area
 * is the same class with a different spec (composition, no base class), so the LSP contract holds for all of them by
 * construction and is still tested per area (`setup-extractor-contract`). Phase 37 adds, all driven by the spec: the
 * document kinds the area reads (`readsFrom`), a recall pass over what the first read did not quote, and a structure
 * refinement over the items found.
 */
import type { DomainError, Result, SetupAreaKey, SourceBlock } from "@donordesk/domain";
import type { ExtractedArea, ISetupAreaExtractor, ISetupLlm, SetupExtractInput } from "@donordesk/application";
import type { AreaExtractionSpec } from "./area-spec.js";
import { addUsage, dropPromptEchoes, recallBlocks, runRefinement } from "./area-passes.js";
import { blocksInScope } from "./document-scope.js";
import { runAreaExtraction } from "./extractor-shared.js";
import { compileSectionTitles, sectionMatches } from "./section-router.js";
import { BLOCKS_HEADER, SETUP_SYSTEM_RULES } from "./prompts/rules.js";

export class PromptedAreaExtractor implements ISetupAreaExtractor {
  readonly area: SetupAreaKey;

  private readonly preferBlock: ((block: SourceBlock) => boolean) | undefined;
  private readonly matcher: RegExp | null;

  constructor(private readonly spec: AreaExtractionSpec, private readonly llm: ISetupLlm) {
    this.area = spec.area;
    const matcher = compileSectionTitles(spec.sectionTitles ?? []);
    this.matcher = matcher;
    this.preferBlock = matcher ? (block) => sectionMatches(block.section, matcher) : undefined;
  }

  feeds(block: SourceBlock): boolean {
    const spec = this.spec;
    const inKind = !block.docKind || block.docKind === "OTHER" || !spec.readsFrom || spec.readsFrom.includes(block.docKind);
    // A part that always reads the opening blocks of every file (the facts) is fed by every file it may read.
    if ((spec.headBlocks ?? 0) > 0 && inKind) return true;
    if (sectionMatches(block.section, this.matcher)) return !block.docKind || block.docKind === "OTHER" || !spec.readsFrom || spec.readsFrom.includes(block.docKind);
    // A specialised file (budget, Gantt, logframe or indicator table) feeds every part that reads its kind; a narrative file only through its headings.
    return !!block.docKind && block.docKind !== "PROPOSAL" && block.docKind !== "OTHER" && !!spec.readsFrom?.includes(block.docKind);
  }

  async extract(input: SetupExtractInput): Promise<Result<ExtractedArea, DomainError>> {
    const spec = this.spec;
    const blocks = blocksInScope(input.blocks, spec.readsFrom);
    const first = await this.read(input, blocks);
    if (!first.ok) return first;
    let { fields, usage } = first.value;
    let partlyRead = first.value.partlyRead;

    if (spec.recallPass) {
      const left = recallBlocks(blocks, fields, spec.keywords);
      if (left.length > 0) {
        const again = await this.read(input, left);
        // A recall read that fails costs nothing already found.
        if (again.ok) {
          fields = spec.merge({ ...fields }, again.value.fields as Record<string, unknown>);
          usage = addUsage(usage, again.value.usage);
          partlyRead = partlyRead && again.value.partlyRead;
        }
      }
    }

    fields = dropPromptEchoes(fields, spec.instructions).fields;

    let promptVersion = spec.promptVersion;
    if (spec.refine) {
      const refined = await runRefinement(spec.refine, { ...fields }, { llm: this.llm, tenantId: input.tenantId, maxTokens: input.maxTokens, timeoutMs: input.timeoutMs });
      fields = refined.fields;
      usage = addUsage(usage, refined.usage);
      if (refined.refined) promptVersion = `${spec.promptVersion}+${spec.refine.promptVersion}`;
    }
    // The prompt that produced the answer is named by the spec, so an eval or an audit row can say which one it measured.
    return { ok: true, value: { ...first.value, fields, usage, partlyRead, promptVersion } };
  }

  private read(input: SetupExtractInput, blocks: ReadonlyArray<SourceBlock>) {
    const spec = this.spec;
    return runAreaExtraction({
      llm: this.llm,
      tenantId: input.tenantId,
      proposalId: input.proposalId,
      blocks,
      sourceText: input.sourceText,
      prior: input.prior,
      maxTokens: spec.maxTokens ?? input.maxTokens,
      timeoutMs: input.timeoutMs,
      keywords: spec.keywords,
      budgetChars: spec.budgetChars,
      headBlocks: spec.headBlocks,
      skipBlock: spec.skipBlock,
      preferBlock: this.preferBlock,
      buildPrompt: (blocksText, prior) => ({
        system: SETUP_SYSTEM_RULES,
        user: [spec.instructions, spec.context ? spec.context(prior) : "", BLOCKS_HEADER, blocksText].filter(Boolean).join("\n\n"),
      }),
      parseChunk: spec.parse,
      merge: spec.merge,
    });
  }
}

export const createSetupExtractors = (specs: readonly AreaExtractionSpec[], llm: ISetupLlm, heavyModel?: string): ISetupAreaExtractor[] =>
  specs.map((spec) => new PromptedAreaExtractor(spec, spec.heavy ? withModel(llm, heavyModel) : llm));
