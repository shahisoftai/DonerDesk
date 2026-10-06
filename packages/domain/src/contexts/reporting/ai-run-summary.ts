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

export interface AiStubAlert {
  /** Sections written with a basic version in the window. */
  stubs: number;
  runs: number;
  /** Why it is raised, in words. */
  reason: string;
}

export const STUB_ALERT_WINDOW_MS = 24 * 60 * 60 * 1000;
export const STUB_ALERT_MIN_RUNS = 4;
export const STUB_ALERT_RATE = 0.3;
export const STUB_ALERT_STREAK = 3;

/**
 * Raises an alert when the AI writer is failing often enough that people are getting basic versions without knowing why:
 * a third of the sections in a day (from four or more runs), or three failures in a row. Newest run first.
 */
export function aiStubAlert(runs: ReadonlyArray<AiRunSummary>, now: Date): AiStubAlert | null {
  const recent = runs.filter((r) => now.getTime() - r.at.getTime() <= STUB_ALERT_WINDOW_MS && r.outcome !== "NO_INPUT");
  if (recent.length === 0) return null;
  const stubs = recent.filter((r) => r.outcome === "STUB").length;
  let streak = 0;
  for (const r of recent) {
    if (r.outcome !== "STUB") break;
    streak += 1;
  }
  if (streak >= STUB_ALERT_STREAK) return { stubs, runs: recent.length, reason: `The last ${streak} sections in a row were written with a basic version.` };
  if (recent.length >= STUB_ALERT_MIN_RUNS && stubs / recent.length >= STUB_ALERT_RATE) {
    return { stubs, runs: recent.length, reason: `${stubs} of ${recent.length} sections in the last day were written with a basic version.` };
  }
  return null;
}
