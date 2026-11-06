/**
 * The passes an area may take after its main read (Phase 37.3), as small functions the extractor composes:
 *  - `recallBlocks`: the relevant blocks no kept item quotes, read once more so a long document does not lose its second half
 *    (LangExtract's "extraction passes");
 *  - `runRefinement`: a small follow-up call over the items found (structure, not content), asked `votes` times at once with
 *    the majority taken by the spec. A refinement that fails keeps the first answer: it can improve an area, never lose one.
 * Neither branches on an area name.
 */
import { tryParseJson, type Result, type DomainError, type SourceBlock, type TenantId } from "@donordesk/domain";
import type { ISetupLlm, SetupUsage } from "@donordesk/application";
import type { AreaRefinement } from "./area-spec.js";
import { withTransientRetry } from "./extractor-shared.js";

/** Less unread text than this is not worth another call. */
export const RECALL_MIN_CHARS = 2_000;

/** The block indices the proposed items of these fields were quoted from. */
export function quotedBlocks(fields: Readonly<Record<string, unknown>>): Set<number> {
  const found = new Set<number>();
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === "object") {
      const ref = (value as { sourceRef?: { block?: unknown } }).sourceRef;
      if (ref && typeof ref.block === "number") found.add(ref.block);
      Object.values(value as Record<string, unknown>).forEach(walk);
    }
  };
  walk(fields);
  return found;
}

/** Blocks naming at least two of the area's words that nothing kept was read from, or [] when too little is left. */
export function recallBlocks(blocks: ReadonlyArray<SourceBlock>, fields: Readonly<Record<string, unknown>>, keywords: ReadonlyArray<string>): SourceBlock[] {
  const quoted = quotedBlocks(fields);
  const left = blocks.filter((b) => {
    if (quoted.has(b.index)) return false;
    const lower = b.text.toLowerCase();
    return keywords.filter((k) => lower.includes(k)).length >= 2;
  });
  return left.reduce((n, b) => n + b.text.length, 0) >= RECALL_MIN_CHARS ? left : [];
}

export const addUsage = (a: SetupUsage | undefined, b: SetupUsage | undefined): SetupUsage => ({
  calls: (a?.calls ?? 0) + (b?.calls ?? 0),
  inputTokens: (a?.inputTokens ?? 0) + (b?.inputTokens ?? 0),
  outputTokens: (a?.outputTokens ?? 0) + (b?.outputTokens ?? 0),
});

const REFINE_SYSTEM = "You organise items already read from a project document. Answer with JSON only, in the exact shape asked. Never add, rename or reword an item.";

export interface RefinementInput {
  llm: ISetupLlm;
  tenantId: TenantId;
  maxTokens: number;
  timeoutMs: number;
  fresh?: boolean | undefined;
}

/** The refined fields and what the calls cost; the fields come back unchanged when there is nothing to refine or no answer. */
export async function runRefinement(refine: AreaRefinement, fields: Record<string, unknown>, input: RefinementInput): Promise<{ fields: Record<string, unknown>; usage: SetupUsage; refined: boolean }> {
  const prompt = refine.prompt(fields);
  const none: SetupUsage = { calls: 0, inputTokens: 0, outputTokens: 0 };
  if (!prompt) return { fields, usage: none, refined: false };
  const ask = (variant: number): Promise<Result<{ text: string; truncated?: boolean | undefined; usage?: { inputTokens: number; outputTokens: number } | undefined } | null, DomainError>> =>
    withTransientRetry(() => input.llm.completeJson({ tenantId: input.tenantId, system: REFINE_SYSTEM, user: prompt, maxTokens: input.maxTokens, timeoutMs: input.timeoutMs, schema: refine.schema, variant, fresh: input.fresh }));
  const replies = await Promise.all(Array.from({ length: Math.max(1, refine.votes) }, (_, variant) => ask(variant)));
  let usage = none;
  const answers: unknown[] = [];
  for (const reply of replies) {
    if (!reply.ok || !reply.value || reply.value.truncated) continue;
    usage = addUsage(usage, { calls: 1, inputTokens: reply.value.usage?.inputTokens ?? 0, outputTokens: reply.value.usage?.outputTokens ?? 0 });
    const parsed = tryParseJson(reply.value.text);
    if (parsed !== undefined) answers.push(parsed);
  }
  if (answers.length === 0) return { fields, usage, refined: false };
  return { fields: refine.apply(fields, answers), usage, refined: true };
}

/** A quote shorter than this is too common to tell an example from the document ("0", "75%"). */
export const ECHO_MIN_CHARS = 12;

const squash = (t: string): string => t.replace(/\s+/g, " ").trim().toLowerCase();

/**
 * Items whose quote is words of the prompt itself (its examples or instructions) are the model echoing the prompt, not
 * reading the document (LangExtract's example-leak check): they are removed before grounding ever sees them, even when the
 * same words happen to be in the document too.
 */
export function dropPromptEchoes(fields: Record<string, unknown>, prompt: string): { fields: Record<string, unknown>; dropped: number } {
  const said = squash(prompt);
  let dropped = 0;
  const echoes = (value: unknown): boolean => {
    const quote = value && typeof value === "object" ? (value as { sourceQuote?: unknown }).sourceQuote : null;
    return typeof quote === "string" && squash(quote).length >= ECHO_MIN_CHARS && said.includes(squash(quote));
  };
  const out = Object.fromEntries(Object.entries(fields).map(([key, value]) => {
    if (!Array.isArray(value)) return [key, value];
    const kept = value.filter((item) => !echoes(item));
    dropped += value.length - kept.length;
    return [key, kept];
  }));
  return { fields: out, dropped };
}
