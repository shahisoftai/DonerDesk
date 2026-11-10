/** A playlist for a wall screen (Phase 48.16): which canvases, in what order, and how long each stays. Pure, so the rules are tested without a browser. */
export const MAX_PLAYLIST = 8;
export const MIN_SECONDS = 10;
export const MAX_SECONDS = 300;
export const DEFAULT_SECONDS = 30;
/** How often a running playlist asks the server for fresh figures. */
export const REFRESH_MS = 5 * 60 * 1000;

const ID = /^[A-Za-z0-9_-]{1,64}$/;

/** The canvas ids a `?ids=` list names: in the order given, no repeats, nothing that is not an id, at most eight. */
export function parsePlaylist(value: string | undefined): string[] {
  const seen = new Set<string>();
  for (const raw of (value ?? "").split(",")) {
    const id = raw.trim();
    if (ID.test(id)) seen.add(id);
    if (seen.size === MAX_PLAYLIST) break;
  }
  return [...seen];
}

/** Seconds on each canvas: a number inside the allowed range, else the default. */
export function secondsOf(value: string | number | undefined): number {
  const n = typeof value === "number" ? value : Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) ? Math.min(MAX_SECONDS, Math.max(MIN_SECONDS, Math.round(n))) : DEFAULT_SECONDS;
}

/** The next position, wrapping round; an empty list stays at 0. */
export const stepIndex = (index: number, count: number, step: 1 | -1): number => (count <= 0 ? 0 : (index + step + count) % count);
