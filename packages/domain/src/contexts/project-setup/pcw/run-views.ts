/**
 * What the reading runs say about the draft (Phase 38.11), pure: which items the reading could not find word for word in the
 * documents (shown, never silently dropped) and which parts are being read again. A run's stored detail is read defensively:
 * anything malformed counts as nothing left out, never as an error on the screen.
 */
export interface ReadingRunLike {
  kind: string;
  area?: string | undefined;
  status: string;
  detail: Readonly<Record<string, string | number | boolean>>;
  startedAt: Date;
}

export const READING_LEFT_OUT_REASONS = ["QUOTE_NOT_FOUND", "FIGURE_NOT_IN_QUOTE", "DATE_NOT_IN_QUOTE"] as const;
export type ReadingLeftOutReason = (typeof READING_LEFT_OUT_REASONS)[number];

export interface ReadingLeftOutItem { field: string; text: string; reason: ReadingLeftOutReason }
export interface ReadingLeftOutArea { area: string; /** All that were left out; the list shown is capped, the count is not. */ total: number; items: ReadingLeftOutItem[] }

/** The latest finished reading of each part that left something out. */
export function leftOutFromRuns(runs: readonly ReadingRunLike[]): ReadingLeftOutArea[] {
  const latest = new Map<string, ReadingRunLike>();
  for (const run of [...runs].sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime())) {
    if (run.kind === "EXTRACT" && run.area && run.status === "FINISHED") latest.set(run.area, run);
  }
  const out: ReadingLeftOutArea[] = [];
  for (const [area, run] of latest) {
    let items: ReadingLeftOutItem[] = [];
    try {
      const raw: unknown = typeof run.detail.leftOut === "string" ? JSON.parse(run.detail.leftOut) : [];
      items = Array.isArray(raw)
        ? raw.flatMap((x) => (x && typeof x === "object" && typeof x.text === "string" && typeof x.field === "string" && (READING_LEFT_OUT_REASONS as readonly string[]).includes(x.reason)
          ? [{ field: x.field as string, text: x.text as string, reason: x.reason as ReadingLeftOutReason }] : []))
        : [];
    } catch {
      items = [];
    }
    const total = Math.max(typeof run.detail.dropped === "number" ? run.detail.dropped : 0, items.length);
    if (total > 0) out.push({ area, total, items });
  }
  return out;
}

export type ReadingAreaRunState = "RUNNING" | "FAILED" | "FINISHED";

/** The state of each part's latest reading. A reading that has gone on longer than `staleMs` has stopped (a restart, a lost request) and is shown as failed so it can be read again. */
export function areaRunStates(runs: readonly ReadingRunLike[], now: Date, staleMs: number): Record<string, ReadingAreaRunState> {
  const latest = new Map<string, ReadingRunLike>();
  for (const run of [...runs].sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime())) if (run.kind === "EXTRACT" && run.area) latest.set(run.area, run);
  const out: Record<string, ReadingAreaRunState> = {};
  for (const [area, run] of latest) {
    out[area] = run.status === "RUNNING" ? (now.getTime() - run.startedAt.getTime() > staleMs ? "FAILED" : "RUNNING") : run.status === "FAILED" ? "FAILED" : "FINISHED";
  }
  return out;
}
