/**
 * Where the map is, as a path of places from the world down to admin 4. Pure.
 *
 * `[]` is the world. Each crumb is a boundary the person opened: the country (level 0), then the units below it.
 * What can be opened comes from the country's available levels (the boundary catalogue), never a fixed depth:
 * a country with files down to level 4 drills four times; one with districts only stops there and says so.
 */
export interface Crumb { level: number; name: string; /** ISO3 for a country, else the unit's P-code or name ref. */ ref: string }
export type DrillPath = readonly Crumb[];

export const WORLD_PATH: DrillPath = [];
export const MAX_DEPTH = 6;

/** The next level below `level` that the country has, or null at the bottom. */
export const levelBelow = (level: number, levels: readonly number[]): number | null => {
  const deeper = levels.filter((l) => l > level);
  return deeper.length === 0 ? null : Math.min(...deeper);
};

/** The level whose boundaries are drawn: countries at the world; below that, the level under the last crumb (or the last crumb's own level at the bottom). */
export function shownLevel(path: DrillPath, levels: readonly number[]): number {
  const last = path[path.length - 1];
  if (!last) return 0;
  return levelBelow(last.level, levels) ?? last.level;
}

/** True when a feature drawn at the current level can be opened: a level exists under it. */
export const canOpen = (path: DrillPath, levels: readonly number[]): boolean => path.length < MAX_DEPTH && levelBelow(shownLevel(path, levels), levels) !== null;

/** Opens the feature drawn at the current level (its crumb carries that level). A feature that cannot be opened leaves the path as it was. */
export function open(path: DrillPath, crumb: Omit<Crumb, "level">, levels: readonly number[]): DrillPath {
  if (!canOpen(path, levels)) return path;
  return [...path, { ...crumb, level: shownLevel(path, levels) }];
}

export const up = (path: DrillPath): DrillPath => path.slice(0, -1);
/** Back to the crumb at `index` (-1 is the world). */
export const toCrumb = (path: DrillPath, index: number): DrillPath => (index < 0 ? WORLD_PATH : path.slice(0, index + 1));

// ---- the address of a view (so a drilled map can be bookmarked and shared) ------------------------------

const PART = /^(\d):([A-Za-z0-9_.:-]{1,48})$/;

export const encodePath = (path: DrillPath): string => path.map((c) => `${c.level}:${c.ref}`).join("/");

/** Reads an address back to refs; anything malformed gives the world. Names are filled in by the caller from the loaded boundaries. */
export function decodePath(text: string | null | undefined): Array<{ level: number; ref: string }> {
  if (!text) return [];
  const parts = text.split("/");
  if (parts.length > MAX_DEPTH) return [];
  const out: Array<{ level: number; ref: string }> = [];
  for (const part of parts) {
    const m = PART.exec(part);
    if (!m) return [];
    out.push({ level: Number(m[1]), ref: m[2]! });
  }
  return out.every((c, i) => i === 0 ? c.level === 0 : c.level > out[i - 1]!.level) ? out : [];
}

/** The place-tree level to read figures at: the level drawn when the places have it, else the nearest deeper one, else the deepest they have. */
export function resultsLevelFor(shown: number, available: readonly number[]): number {
  if (available.length === 0 || available.includes(shown)) return shown;
  return available.filter((l) => l >= shown).sort((a, b) => a - b)[0] ?? Math.max(...available);
}
