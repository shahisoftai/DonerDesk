/**
 * The shared extraction machinery (Phase 36.2): block selection by area keywords, chunking to the model's budget, one
 * transient retry per call (never a second), parse via `tryParseJson`, and chunk-result merging. No abstract base
 * extractor: these are small functions each extractor composes, and none of them branches on an area name.
 */
import { DomainError, err, ok, tryParseJson } from "@donordesk/domain";
import type { ExtractedArea, ISetupLlm, SetupUsage } from "@donordesk/application";
import type { Result, SourceBlock, TenantId } from "@donordesk/domain";
import { sectionLabel } from "./section-router.js";

/** What one area reads of a document: the best-matching passages up to this many characters, in at most MAX_CHUNKS calls. */
export const SELECTION_BUDGET_CHARS = 30_000;
export const CHUNK_CHARS = 12_000;
export const MAX_CHUNKS = 3;
/** Sections the survey assigned to an area are read whole, up to this much: long documents are not cut to the ordinary budget. */
export const DEEP_READ_CHARS = 120_000;
const TRUNCATED_REPLY = "The answer was cut off at the token limit.";

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
  skipBlock?: ((block: SourceBlock) => boolean) | undefined;
  /** Blocks of the sections this area normally reads: taken first, whole, before keyword ranking fills the rest. */
  preferBlock?: ((block: SourceBlock) => boolean) | undefined;
  buildPrompt: (blocksText: string, prior: Readonly<Record<string, unknown>>) => { system: string; user: string };
  parseChunk: ChunkParser;
  merge: ChunkMerger;
  /** The JSON Schema of a reply, for a provider that can enforce it. */
  schema?: Record<string, unknown> | undefined;
  fresh?: boolean | undefined;
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
export function selectBlocks(blocks: ReadonlyArray<SourceBlock>, keywords: ReadonlyArray<string>, budget = SELECTION_BUDGET_CHARS, headBlocks = 0, skipBlock?: (block: SourceBlock) => boolean, preferBlock?: (block: SourceBlock) => boolean): { text: string; truncated: boolean } {
  const scored = blocks.filter((b) => !skipBlock?.(b)).map((block) => {
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
  // Sections the area normally reads come first and whole, in reading order; keywords rank what is left.
  const routed = scored.filter((x) => preferBlock?.(x.block) && !head.has(x.block.index));
  const routedIds = new Set(routed.map((x) => x.block.index));
  const ranked = matching.length >= 3
    ? [...scored.filter((x) => head.has(x.block.index)), ...routed, ...[...matching].filter((x) => !head.has(x.block.index) && !routedIds.has(x.block.index)).sort((a, b) => b.score - a.score || a.block.index - b.block.index)]
    : routed.length > 0 ? [...scored.filter((x) => head.has(x.block.index)), ...routed, ...scored.filter((x) => !head.has(x.block.index) && !routedIds.has(x.block.index))] : scored;
  const candidates = ranked;
  const chosen: SourceBlock[] = [];
  let truncated = false;
  let length = 0;
  for (const { block } of candidates) {
    const size = `[${block.index}] ${block.text}`.length + 1;
    if (length + size > budget) {
      truncated = true;
      // Ranked selection may still fit a smaller, lower-ranked block; an in-order read stops at the first that does not fit.
      if (matching.length >= 3 || routed.length > 0) continue;
      break;
    }
    chosen.push(block);
    length += size;
  }
  chosen.sort((a, b) => a.index - b.index);
  // A label line names the section each run of blocks belongs to, so the model knows where it is reading.
  const lines: string[] = [];
  let current: string | undefined;
  for (const b of chosen) {
    if (b.section && b.section !== current) lines.push(sectionLabel(b.section));
    current = b.section;
    if (b.columns) lines.push(sectionLabel(`columns: ${b.columns}`));
    lines.push(`[${b.index}] ${b.text}`);
  }
  return { text: lines.join("\n"), truncated };
}

/** Whole blocks per call, at most MAX_CHUNKS calls; anything beyond is reported, never read silently. */
export function chunkBlocksText(text: string, maxChunks = MAX_CHUNKS): { chunks: string[]; partlyRead: boolean } {
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
      if (chunks.length === maxChunks) return { chunks, partlyRead: true };
    }
    carry.push(line);
    length += line.length + 1;
  }
  if (carry.length > 0 && chunks.length < maxChunks) chunks.push(carry.join("\n"));
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
type ChunkReply = { fields: Record<string, unknown>; model: string; promptVersion: string; usage?: { inputTokens: number; outputTokens: number } | undefined; unreadable: { field: string; text: string }[] };

/** List items in the reply that the area's reader did not keep. */
function unreadItems(raw: unknown, fields: Record<string, unknown>): { field: string; text: string }[] {
  if (!raw || typeof raw !== "object") return [];
  return Object.entries(fields).flatMap(([field, kept]) => {
    const asked = (raw as Record<string, unknown>)[field];
    if (!Array.isArray(asked) || !Array.isArray(kept) || asked.length <= kept.length) return [];
    const keptQuotes = new Set((kept as { sourceQuote?: unknown }[]).map((k) => k.sourceQuote));
    return asked.filter((a) => a && typeof a === "object" && !keptQuotes.has(String((a as { quote?: unknown }).quote ?? "").slice(0, 400))).map((a) => {
      const r = a as Record<string, unknown>;
      return { field, text: String(r.title ?? r.name ?? r.category ?? r.quote ?? "").slice(0, 200) };
    });
  });
}

/** A reply cut at the token limit is a failure even when it parses. After its retry, the chunk is read in two halves, once. */
async function readChunk(input: RunAreaExtractionInput, chunk: string, canSplit = true): Promise<Result<ChunkReply, DomainError>> {
  const whole = await readChunkOnce(input, chunk);
  if (whole.ok || whole.error.message !== TRUNCATED_REPLY || !canSplit) return whole;
  const lines = chunk.split("\n");
  if (lines.length < 2) return whole;
  const middle = Math.ceil(lines.length / 2);
  const [a, b] = await Promise.all([readChunk(input, lines.slice(0, middle).join("\n"), false), readChunk(input, lines.slice(middle).join("\n"), false)]);
  if (!a.ok) return a;
  if (!b.ok) return b;
  return ok({
    fields: input.merge(a.value.fields, b.value.fields), model: a.value.model, promptVersion: a.value.promptVersion,
    usage: { inputTokens: (a.value.usage?.inputTokens ?? 0) + (b.value.usage?.inputTokens ?? 0), outputTokens: (a.value.usage?.outputTokens ?? 0) + (b.value.usage?.outputTokens ?? 0) },
    unreadable: [...a.value.unreadable, ...b.value.unreadable],
  });
}

async function readChunkOnce(input: RunAreaExtractionInput, chunk: string): Promise<Result<ChunkReply, DomainError>> {
  return withTransientRetry(async () => {
    const reply = await input.llm.completeJson({ tenantId: input.tenantId, ...input.buildPrompt(chunk, input.prior), maxTokens: input.maxTokens, timeoutMs: input.timeoutMs, schema: input.schema, fresh: input.fresh });
    if (!reply.ok) return reply;
    if (reply.value === null) return err(new DomainError("POLICY_DENIED", "The AI service is not available for this organisation right now."));
    if (reply.value.truncated) return err(new DomainError("VALIDATION_FAILED", TRUNCATED_REPLY));
    if (reply.value.text.trim() === "") {
      // A reasoning model that spent its budget thinking answers nothing: say so, never read it as "nothing found".
      return err(new DomainError("VALIDATION_FAILED", "The model returned an empty answer for this area (its token budget may be too small)."));
    }
    const parsed = tryParseJson(reply.value.text);
    if (parsed === undefined) return err(new DomainError("VALIDATION_FAILED", "The model did not answer with readable JSON for this area."));
    const fields = input.parseChunk(parsed, { blocks: input.blocks, sourceText: input.sourceText });
    if (typeof fields === "string") return err(new DomainError("VALIDATION_FAILED", fields));
    return ok({ fields, model: reply.value.model, promptVersion: reply.value.promptVersion, usage: reply.value.usage, unreadable: unreadItems(parsed, fields) });
  });
}

/** The whole per-area run: select, chunk, call (the chunks at the same time), parse, merge in reading order. */
export async function runAreaExtraction(input: RunAreaExtractionInput): Promise<Result<ExtractedArea, DomainError>> {
  const base = input.budgetChars ?? SELECTION_BUDGET_CHARS;
  const routedChars = input.preferBlock ? input.blocks.filter((b) => !input.skipBlock?.(b) && input.preferBlock!(b)).reduce((n, b) => n + b.text.length + 16, 0) : 0;
  const budget = Math.max(base, Math.min(routedChars, DEEP_READ_CHARS));
  const selected = selectBlocks(input.blocks, input.keywords, budget, input.headBlocks ?? 0, input.skipBlock, input.preferBlock);
  const { chunks, partlyRead: chunked } = chunkBlocksText(selected.text, Math.max(MAX_CHUNKS, Math.ceil(budget / CHUNK_CHARS) + 1));
  const partlyRead = selected.truncated || chunked;
  if (chunks.length === 0) {
    return err(new DomainError("VALIDATION_FAILED", "The document has no readable text for this area."));
  }
  const replies = await Promise.all(chunks.map((chunk) => readChunk(input, chunk)));
  const firstFailure = replies.find((r) => !r.ok);
  const anyRead = replies.some((r) => r.ok);
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
  // What was read is kept when another chunk failed; the area says it was partly read.
  if (firstFailure && !anyRead) return firstFailure;
  const unreadable: { field: string; text: string }[] = [];
  for (const reply of replies) {
    if (!reply.ok) continue;
    unreadable.push(...reply.value.unreadable);
    merged = input.merge(merged, reply.value.fields);
    model = model ?? reply.value.model;
    promptVersion = promptVersion ?? reply.value.promptVersion;
  }
  return ok({ fields: merged, partlyRead: partlyRead || !!firstFailure, model, promptVersion, usage, ...(unreadable.length > 0 ? { unreadable } : {}) });
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
