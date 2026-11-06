/**
 * What the reading popup shows: one line per part of the project, taken from the draft's own run states, never invented. A part
 * with no run yet is waiting. Pure: no clock, no React.
 */
export const READING_PARTS = ["FACTS", "LOGFRAME", "INDICATORS", "PERIODS", "PLAN", "PLACES", "FUNDING_BUDGET", "RISKS"] as const;
export type ReadingPart = (typeof READING_PARTS)[number];
export type PartState = "WAITING" | "READING" | "DONE" | "FAILED";

export interface ReadingProgress {
  parts: ReadonlyArray<{ part: ReadingPart; state: PartState }>;
  done: number;
  total: number;
  failed: number;
  /** 0 to 100, rounded. Parts that failed count as finished: the reading has nothing more to do for them. */
  percent: number;
}

const STATE_OF = { RUNNING: "READING", FINISHED: "DONE", FAILED: "FAILED" } as const;

export function readingProgress(areaRuns: Readonly<Record<string, "RUNNING" | "FAILED" | "FINISHED">>): ReadingProgress {
  const parts = READING_PARTS.map((part) => ({ part, state: (areaRuns[part] ? STATE_OF[areaRuns[part]!] : "WAITING") as PartState }));
  const done = parts.filter((p) => p.state === "DONE").length;
  const failed = parts.filter((p) => p.state === "FAILED").length;
  return { parts, done, total: parts.length, failed, percent: Math.round(((done + failed) / parts.length) * 100) };
}

/** The file names the popup lists, without any path, at most `limit` of them. */
export function readingFileNames(sources: ReadonlyArray<{ name: string }>, limit = 5): string[] {
  return sources.slice(0, limit).map((s) => s.name.split(/[\\/]/).pop() ?? s.name);
}
