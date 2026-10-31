/**
 * The shared extraction machinery (Phase 36.2): block selection by area keywords, chunking to the model's budget, one
 * transient retry per call (never a second), parse via `tryParseJson`, and chunk-result merging. No abstract base
 * extractor: these are small functions each extractor composes, and none of them branches on an area name.
 */
import { DomainError, err, ok, tryParseJson } from "@donordesk/domain";
import type { ExtractedArea, ISetupLlm, SetupUsage } from "@donordesk/application";
import type { Result, SourceBlock, TenantId } from "@donordesk/domain";

export const SELECTION_BUDGET_CHARS = 48_000;
export const CHUNK_CHARS = 16_000;
export const MAX_CHUNKS = 4;

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

/** Blocks worth reading for these keywords; a document that names none in the area's vocabulary is read whole (capped). */
export function selectBlocks(blocks: ReadonlyArray<SourceBlock>, keywords: ReadonlyArray<string>, budget = SELECTION_BUDGET_CHARS): { text: string; truncated: boolean } {
  const matching = blocks.filter((b) => keywords.some((k) => b.text.toLowerCase().includes(k)));
  const chosen = matching.length >= 3 ? matching : blocks;
  const lines: string[] = [];
  let truncated = false;
  let length = 0;
  for (const block of chosen) {
    const line = `[${block.index}] ${block.text}`;
    if (length + line.length > budget) {
      truncated = true;
      break;
    }
    lines.push(line);
    length += line.length + 1;
  }
  return { text: lines.join("\n"), truncated };
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
  if (first.ok) return first;
  // A rate limit needs longer than a blip to clear.
  await sleep(first.error.code === "RATE_LIMITED" ? 8_000 : 1_500);
  return work();
}

/** The whole per-area run: select, chunk, call, parse, merge. */
export async function runAreaExtraction(input: RunAreaExtractionInput): Promise<Result<ExtractedArea, DomainError>> {
  const selected = selectBlocks(input.blocks, input.keywords);
  const { chunks, partlyRead: chunked } = chunkBlocksText(selected.text);
  const partlyRead = selected.truncated || chunked;
  if (chunks.length === 0) {
    return err(new DomainError("VALIDATION_FAILED", "The document has no readable text for this area."));
  }
  let merged: Record<string, unknown> = {};
  let model: string | undefined;
  let promptVersion: string | undefined;
  const usage: SetupUsage = { calls: 0, inputTokens: 0, outputTokens: 0 };
  for (const chunk of chunks) {
    const reply = await withTransientRetry(() =>
      input.llm.completeJson({ tenantId: input.tenantId, ...input.buildPrompt(chunk, input.prior), maxTokens: input.maxTokens, timeoutMs: input.timeoutMs }),
    );
    if (!reply.ok) return reply;
    if (reply.value !== null) {
      usage.calls += 1;
      usage.inputTokens += reply.value.usage?.inputTokens ?? 0;
      usage.outputTokens += reply.value.usage?.outputTokens ?? 0;
    }
    if (reply.value === null) {
      return err(new DomainError("POLICY_DENIED", "The AI service is not available for this organisation right now."));
    }
    const parsed = reply.value.text.trim() === "" ? null : tryParseJson(reply.value.text);
    if (parsed === undefined) {
      return err(new DomainError("VALIDATION_FAILED", "The model did not answer with readable JSON for this area."));
    }
    if (reply.value.text.trim() === "") {
      // A reasoning model that spent its budget thinking answers nothing: say so, never read it as "nothing found".
      return err(new DomainError("VALIDATION_FAILED", "The model returned an empty answer for this area (its token budget may be too small)."));
    }
    const fields = input.parseChunk(parsed, { blocks: input.blocks, sourceText: input.sourceText });
    if (typeof fields === "string") {
      return err(new DomainError("VALIDATION_FAILED", fields));
    }
    merged = input.merge(merged, fields);
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
