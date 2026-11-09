/**
 * Live data on screen (Phase 48.17), as pure rules. The page asks for version numbers on a timer; these functions decide what to
 * do with the answer. No React, no clock of its own (time is passed in), so the rules are table-tested.
 */
export type Versions = Readonly<Record<string, number>>;
export interface ProjectState { epoch: string; versions: Versions }
export type SeenState = Readonly<Record<string, ProjectState>>;

/** The first ask is not a change: it only records what is there. */
export function sourcesChanged(seen: ProjectState | undefined, now: ProjectState): string[] {
  if (!seen) return [];
  // A different epoch means the server restarted and its counters began again: every source may have changed.
  if (seen.epoch !== now.epoch) return Object.keys({ ...seen.versions, ...now.versions });
  return Object.keys({ ...seen.versions, ...now.versions }).filter((s) => (seen.versions[s] ?? 0) !== (now.versions[s] ?? 0));
}

export interface BlockReads { blockId: string; projectId: string; sources: readonly string[] }

/** The blocks to ask again after a poll: those that read a project whose source changed. */
export function blocksToReload(reads: ReadonlyArray<BlockReads>, seen: SeenState, now: Readonly<Record<string, ProjectState>>): string[] {
  const changed = new Map(Object.keys(now).map((p) => [p, new Set(sourcesChanged(seen[p], now[p]!))]));
  return reads.filter((b) => b.sources.some((s) => changed.get(b.projectId)?.has(s))).map((b) => b.blockId);
}

export const POLL_SECONDS = 30;
export const MAX_BACKOFF_SECONDS = 300;

/** Seconds until the next ask: steady while it works, doubling (up to five minutes) after failures, never while the tab is hidden. */
export function nextPollDelay(input: { failures: number; hidden: boolean; offline: boolean }): number | null {
  if (input.hidden || input.offline) return null;
  if (input.failures <= 0) return POLL_SECONDS;
  return Math.min(MAX_BACKOFF_SECONDS, POLL_SECONDS * 2 ** input.failures);
}

/** A figure that changed since the last draw, to highlight briefly. */
export function changedFigures(before: ReadonlyArray<Record<string, string | number | null>>, after: ReadonlyArray<Record<string, string | number | null>>, keys: readonly string[]): Set<string> {
  const out = new Set<string>();
  after.forEach((row, i) => { const old = before[i]; if (old) for (const k of keys) if (old[k] !== row[k]) out.add(`${i}:${k}`); });
  return out;
}
