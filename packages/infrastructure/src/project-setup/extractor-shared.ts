/**
 * The shared extraction machinery (Phase 36.2): block selection by area keywords, chunking to the model's budget, one
 * transient retry per call (never a second), parse via `tryParseJson`, and chunk-result merging. No abstract base
 * extractor: these are small functions each extractor composes, and none of them branches on an area name.
 */
import { DomainError, err, ok, tryParseJson } from "@donordesk/domain";
import type { ExtractedArea, ISetupLlm, SetupUsage } from "@donordesk/application";
import type { Result, SourceBlock, TenantId } from "@donordesk/domain";

/** What one area reads of a document: the best-matching passages up to this many characters, in at most MAX_CHUNKS calls. */
export const SELECTION_BUDGET_CHARS = 30_000;
export const CHUNK_CHARS = 12_000;
export const MAX_CHUNKS = 3;

export interface ChunkContext {
  blocks: ReadonlyArray<SourceBlock>;
  sourceText: string;
}

/** Turns one parsed model reply into the area's proposal fields, or a plain reason it could not. */
export type ChunkParser = (raw: unknown, ctx: ChunkContext) => Record<string, unknown> | string;
export type ChunkMerger = (a: Record<string, unknown>, b: Record<string, unknown>) => Record<string, unknown>;

export interface RunAreaExtractionInput {
  llm: ISetupLlm;
  tenantId: TenantId;
  proposalId: string;
  blocks: ReadonlyArray<SourceBlock>;
  sourceText: string;
  prior: Readonly<Record<string, unknown>>;
  maxTokens: number;
  timeoutMs: number;
  keywords: ReadonlyArray<string>;
  /** Overrides SELECTION_BUDGET_CHARS for an area that needs less (or more) of the document. */
  budgetChars?: number | undefined;
  /** Blocks always read from the start of each document (titles, cover pages), before any keyword match. */
  headBlocks?: number | undefined;
  buildPrompt: (blocksText: string, prior: Readonly<Record<string, unknown>>) => { system: string; user: string };
  parseChunk: ChunkParser;
  merge: ChunkMerger;
}

export interface ExtractorRun {
  fields: Record<string, unknown>;
  partlyRead: boolean;
  usage?: SetupUsage;
  model?: string | undefined;
  promptVersion?: string | undefined;
}

/**
 * The blocks worth reading for these keywords: the first `headBlocks` of every document, then the blocks that name the most
 * different keywords, until the budget is spent, returned in reading order. A document that names fewer than three of the
 * area's words is read from the top (capped) instead.
 */
export function selectBlocks(blocks: ReadonlyArray<SourceBlock>, keywords: ReadonlyArray<string>, budget = SELECTION_BUDGET_CHARS, headBlocks = 0): { text: string; truncated: boolean } {
  const scored = blocks.map((block) => {
    const lower = block.text.toLowerCase();
    return { block, score: keywords.reduce((n, k) => n + (lower.includes(k) ? 1 : 0), 0) };
  });
  const matching = scored.filter((x) => x.score > 0);
  const seenPerDocument = new Map<string, number>();
  const head = new Set<number>();
  for (const { block } of scored) {
    const seen = seenPerDocument.get(block.documentId) ?? 0;
    if (seen < headBlocks) head.add(block.index);
    seenPerDocument.set(block.documentId, seen + 1);
  }
  const candidates = matching.length >= 3 ? [...scored.filter((x) => head.has(x.block.index)), ...[...matching].filter((x) => !head.has(x.block.index)).sort((a, b) => b.score - a.score || a.block.index - b.block.index)] : scored;
  const chosen: SourceBlock[] = [];
  let truncated = false;
  let length = 0;
  for (const { block } of candidates) {
    const size = `[${block.index}] ${block.text}`.length + 1;
    if (length + size > budget) {
      truncated = true;
      // Ranked selection may still fit a smaller, lower-ranked block; an in-order read stops at the first that does not fit.
      if (matching.length >= 3) continue;
      break;
    }
    chosen.push(block);
    length += size;
  }
  chosen.sort((a, b) => a.index - b.index);
  return { text: chosen.map((b) => `[${b.index}] ${b.text}`).join("\n"), truncated };
}

/** Whole blocks per call, at most MAX_CHUNKS calls; anything beyond is reported, never read silently. */
export function chunkBlocksText(text: string): { chunks: string[]; partlyRead: boolean } {
  if (text.length <= CHUNK_CHARS) return { chunks: text ? [text] : [], partlyRead: false };
  const lines = text.split("\n");
  const chunks: string[] = [];
  let carry: string[] = [];
  let length = 0;
  for (const line of lines) {
    if (length > 0 && length + line.length + 1 > CHUNK_CHARS) {
      chunks.push(carry.join("\n"));
      carry = [];
      length = 0;
      if (chunks.length === MAX_CHUNKS) return { chunks, partlyRead: true };
    }
    carry.push(line);
    length += line.length + 1;
  }
  if (carry.length > 0 && chunks.length < MAX_CHUNKS) chunks.push(carry.join("\n"));
  else if (carry.length > 0) return { chunks, partlyRead: true };
  return { chunks, partlyRead: false };
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** One transient retry with backoff — the same rule as the AI Reporter's; a second retry is never added here. */
export async function withTransientRetry<T>(work: () => Promise<Result<T, DomainError>>): Promise<Result<T, DomainError>> {
  const first = await work();
  // A refusal of policy (no AI for this organisation, a key not accepted) is the same the second time.
  if (first.ok || first.error.code === "POLICY_DENIED") return first;
  // A rate limit needs longer than a blip to clear.
  await sleep(first.error.code === "RATE_LIMITED" ? 8_000 : 1_500);
  return work();
}

/** One chunk: ask, read the reply, parse it. An unreadable or empty reply is retried once like any other transient failure. */
async function readChunk(input: RunAreaExtractionInput, chunk: string): Promise<Result<{ fields: Record<string, unknown>; model: string; promptVersion: string; usage?: { inputTokens: number; outputTokens: number } | undefined }, DomainError>> {
  return withTransientRetry(async () => {
    const reply = await input.llm.completeJson({ tenantId: input.tenantId, ...input.buildPrompt(chunk, input.prior), maxTokens: input.maxTokens, timeoutMs: input.timeoutMs });
    if (!reply.ok) return reply;
    if (reply.value === null) return err(new DomainError("POLICY_DENIED", "The AI service is not available for this organisation right now."));
    if (reply.value.text.trim() === "") {
      // A reasoning model that spent its budget thinking answers nothing: say so, never read it as "nothing found".
      return err(new DomainError("VALIDATION_FAILED", "The model returned an empty answer for this area (its token budget may be too small)."));
    }
    const parsed = tryParseJson(reply.value.text);
    if (parsed === undefined) return err(new DomainError("VALIDATION_FAILED", "The model did not answer with readable JSON for this area."));
    const fields = input.parseChunk(parsed, { blocks: input.blocks, sourceText: input.sourceText });
    if (typeof fields === "string") return err(new DomainError("VALIDATION_FAILED", fields));
    return ok({ fields, model: reply.value.model, promptVersion: reply.value.promptVersion, usage: reply.value.usage });
  });
}

/** The whole per-area run: select, chunk, call (the chunks at the same time), parse, merge in reading order. */
export async function runAreaExtraction(input: RunAreaExtractionInput): Promise<Result<ExtractedArea, DomainError>> {
  const selected = selectBlocks(input.blocks, input.keywords, input.budgetChars ?? SELECTION_BUDGET_CHARS, input.headBlocks ?? 0);
  const { chunks, partlyRead: chunked } = chunkBlocksText(selected.text);
  const partlyRead = selected.truncated || chunked;
  if (chunks.length === 0) {
    return err(new DomainError("VALIDATION_FAILED", "The document has no readable text for this area."));
  }
  const replies = await Promise.all(chunks.map((chunk) => readChunk(input, chunk)));
  let merged: Record<string, unknown> = {};
  let model: string | undefined;
  let promptVersion: string | undefined;
  const usage: SetupUsage = { calls: 0, inputTokens: 0, outputTokens: 0 };
  for (const reply of replies) {
    // Calls that did answer are still paid for, so their tokens are counted even when a sibling chunk failed.
    if (reply.ok) {
      usage.calls += 1;
      usage.inputTokens += reply.value.usage?.inputTokens ?? 0;
      usage.outputTokens += reply.value.usage?.outputTokens ?? 0;
    }
  }
  for (const reply of replies) {
    if (!reply.ok) return reply;
    merged = input.merge(merged, reply.value.fields);
    model = model ?? reply.value.model;
    promptVersion = promptVersion ?? reply.value.promptVersion;
  }
  return ok({ fields: merged, partlyRead, model, promptVersion, usage });
}


/** Concatenates one list field and drops exact duplicates by a key. */
export function mergeLists(keyOf: (item: Record<string, unknown>) => string, ...listFields: ReadonlyArray<string>): ChunkMerger {
  return (a, b) => {
    const out: Record<string, unknown> = { ...a };
    for (const field of listFields) {
      const seen = new Set((Array.isArray(a[field]) ? (a[field] as Record<string, unknown>[]) : []).map(keyOf));
      const combined = [
        ...(Array.isArray(a[field]) ? (a[field] as Record<string, unknown>[]) : []),
        ...(Array.isArray(b[field]) ? (b[field] as Record<string, unknown>[]).filter((item) => !seen.has(keyOf(item))) : []),
      ];
      out[field] = combined;
    }
    return out;
  };
}
