import { isGenerationFallbackReason, type GenerationFallbackReason } from "./generation-fallback.js";

/**
 * What an administrator sees of one AI section run: whether the AI wrote the section, was asked twice, or a basic
 * version was used (and why). Built from the ledger row so nobody has to read the server log to find out.
 */
export interface AiRunRecord {
  id: string;
  /** success | error | timeout | skipped, as recorded. */
  status: string;
  /** The fallback reason, recorded when the run did not produce usable AI text. */
  errorMessage?: string | null;
  /** Redacted diagnostics JSON written with the run (section title, attempts, detail). */
  responseText?: string | null;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  createdAt: Date;
}

export type AiRunOutcome = "WRITTEN" | "RECOVERED" | "STUB" | "NO_INPUT";

export interface AiRunSummary {
  id: string;
  at: Date;
  sectionTitle: string | null;
  outcome: AiRunOutcome;
  /** Present for a STUB run whose reason was recorded. */
  reason: GenerationFallbackReason | null;
  /** Short, user-safe detail ("figure not in your data: 33.3"). */
  detail: string | null;
  /** Provider calls made for the section. */
  attempts: number;
  latencyMs: number;
  tokens: number;
}

interface RunDiagnostics {
  sectionTitle?: unknown;
  attempts?: unknown;
  fallbackDetail?: unknown;
}

function parseDiagnostics(text: string | null | undefined): RunDiagnostics {
  if (!text) return {};
  try {
    const parsed: unknown = JSON.parse(text);
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as RunDiagnostics) : {};
  } catch {
    return {};
  }
}

const asText = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value.trim() : null);

export function summarizeAiRun(run: AiRunRecord): AiRunSummary {
  const diagnostics = parseDiagnostics(run.responseText);
  const attempts = typeof diagnostics.attempts === "number" && diagnostics.attempts >= 1 ? Math.floor(diagnostics.attempts) : 1;
  const outcome: AiRunOutcome =
    run.status === "skipped" ? "NO_INPUT" : run.status === "success" ? (attempts >= 2 ? "RECOVERED" : "WRITTEN") : "STUB";
  return {
    id: run.id,
    at: run.createdAt,
    sectionTitle: asText(diagnostics.sectionTitle),
    outcome,
    reason: outcome === "STUB" && isGenerationFallbackReason(run.errorMessage) ? run.errorMessage : null,
    detail: outcome === "STUB" ? asText(diagnostics.fallbackDetail) : null,
    attempts,
    latencyMs: run.latencyMs,
    tokens: run.inputTokens + run.outputTokens,
  };
}

/** Counts per outcome, for the one-line summary above the table. */
export function countAiRunOutcomes(runs: ReadonlyArray<AiRunSummary>): Record<AiRunOutcome, number> {
  const counts: Record<AiRunOutcome, number> = { WRITTEN: 0, RECOVERED: 0, STUB: 0, NO_INPUT: 0 };
  for (const run of runs) counts[run.outcome] += 1;
  return counts;
}
