/**
 * Recording an indicator one figure per place (Phase 53.2). The map is drawn from figures that name a place, so this is the rule that makes
 * "where we work" and "what we recorded" meet: which places an indicator is entered at, which indicators should be, and the total of the
 * places. Additive types sum; a rate or ratio is never summed (the total is typed). A missing figure is never 0. Pure; no node: imports.
 */
import { disaggregationMustSum, type DisaggregationEntry } from "../logframe/indicator-disaggregation.js";
import type { IndicatorType } from "../logframe/indicator.js";

export interface RecordablePlace { id: string; name: string; adminLevel: number; archived: boolean; /** "Rabak › White Nile › Sudan": tells two places with one name apart. */ path?: string | undefined }
export interface PlaceRow { placeId: string; name: string; path: string }

const live = (places: readonly RecordablePlace[]): RecordablePlace[] => places.filter((p) => !p.archived);

/** The level most places are at below the country (ties go to the shallower level); null when there are none. */
export function defaultPlaceLevel(places: readonly RecordablePlace[], usedIds: readonly string[] = []): number | null {
  // The project's own places decide the level when it has any; the organisation's whole list is only the fallback.
  const used = new Set(usedIds);
  const mine = live(places).filter((p) => used.has(p.id) && p.adminLevel >= 1);
  const pool = mine.length > 0 ? mine : live(places);
  const counts = new Map<number, number>();
  for (const p of pool) if (p.adminLevel >= 1) counts.set(p.adminLevel, (counts.get(p.adminLevel) ?? 0) + 1);
  let best: number | null = null;
  for (const [level, n] of [...counts].sort((a, b) => a[0] - b[0])) if (best === null || n > (counts.get(best) ?? 0)) best = level;
  return best;
}

/** The rows of the by-place entry: one per live place at the level, in name order. */
export function placeRows(places: readonly RecordablePlace[], level: number): PlaceRow[] {
  return live(places).filter((p) => p.adminLevel === level).sort((a, b) => a.name.localeCompare(b.name)).map((p) => ({ placeId: p.id, name: p.name, path: p.path ?? p.name }));
}

export type RecordByPlaceVerdict = { ok: true; level: number } | { ok: false; reason: "NO_PLACES" | "CALCULATED" };

/** Whether an indicator can be recorded by place, and at which level when it has not chosen one. A calculated indicator is never typed. */
export function canRecordByPlace(indicator: { calculated: boolean; placeLevel?: number | null | undefined }, places: readonly RecordablePlace[], usedIds: readonly string[] = []): RecordByPlaceVerdict {
  if (indicator.calculated) return { ok: false, reason: "CALCULATED" };
  const level = indicator.placeLevel ?? defaultPlaceLevel(places, usedIds);
  if (level === null || placeRows(places, level).length === 0) return { ok: false, reason: "NO_PLACES" };
  return { ok: true, level };
}

export interface PlaceRecordingCandidate { id: string; type: IndicatorType; calculated: boolean; recordByPlace: boolean; placeLevel?: number | null | undefined }
export interface PlaceRecordingSuggestion { indicatorId: string; level: number }

/** The indicators a project with places should probably record by place: a suggestion shown to the person, never applied silently. */
export function suggestPlaceRecording(indicators: readonly PlaceRecordingCandidate[], places: readonly RecordablePlace[]): PlaceRecordingSuggestion[] {
  const level = defaultPlaceLevel(places);
  if (level === null) return [];
  return indicators.filter((i) => !i.recordByPlace && !i.calculated && disaggregationMustSum(i.type)).map((i) => ({ indicatorId: i.id, level }));
}

const toNumber = (value: string): number | null => {
  const cleaned = value.replace(/[,\s]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
};

/** The total of the places' figures: only for an additive type and only from figures that were typed; no figure means no total (null), never 0. */
export function totalFromPlaces(type: IndicatorType, entries: ReadonlyArray<Pick<DisaggregationEntry, "value">>): string | null {
  if (!disaggregationMustSum(type)) return null;
  const numbers = entries.map((e) => toNumber(e.value)).filter((n): n is number => n !== null);
  if (numbers.length === 0) return null;
  return String(numbers.reduce((a, b) => a + b, 0));
}

/**
 * The rows a by-place entry starts with: the places the project already uses (its planned work and figures), at the indicator's level.
 * Nothing is guessed from the whole organisation's list; anything else is added by the person (see `matchPlaceChoice`).
 */
export function startingRows(rows: readonly PlaceRow[], usedIds: readonly string[]): PlaceRow[] {
  const used = new Set(usedIds);
  return rows.filter((r) => used.has(r.placeId));
}

/** The place a typed or chosen text names: its path, else its name when that is unique among the candidates; never a guess. */
export function matchPlaceChoice(text: string, candidates: readonly PlaceRow[]): PlaceRow | null {
  const t = text.trim().toLowerCase();
  if (!t) return null;
  const byPath = candidates.filter((c) => c.path.toLowerCase() === t);
  if (byPath.length === 1) return byPath[0]!;
  const byName = candidates.filter((c) => c.name.toLowerCase() === t);
  return byName.length === 1 ? byName[0]! : null;
}

/** The LOCATION breakdown entries for the places that have a typed figure (an empty box is left out, not stored as 0). */
export function placeEntries(figures: ReadonlyArray<{ name: string; value: string }>): DisaggregationEntry[] {
  return figures.filter((f) => f.value.trim() !== "").map((f) => ({ dimension: "LOCATION" as const, category: f.name, value: f.value.trim() }));
}
