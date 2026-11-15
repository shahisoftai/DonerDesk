/**
 * Where an indicator is measured (Phase 56). PROJECT: one figure for the whole project. LEVEL: one figure per footprint place at an admin
 * level ("every district we work in"). CHOSEN: one figure per place the person picked. By-place figures are stored as LOCATION breakdown
 * entries that carry the place's id beside its name, so a rename keeps history and two villages called the same stay apart; older entries
 * with a name only are read by a unique match, never a guess. Pure; no node: imports.
 */
import { DomainError } from "../../core/domain-error.js";
import { err, ok, type Result } from "../../core/result.js";
import { normalizeLocationKey } from "../workplan/location-key.js";
import type { DisaggregationEntry } from "../logframe/indicator-disaggregation.js";
import { isAdminLevel, type AdminLevel } from "./place.js";
import type { PlaceTree } from "./place-tree.js";
import { placesForNewWork, type ProjectAreaRecord } from "./footprint.js";

export const INDICATOR_PLACE_SCOPES = ["PROJECT", "LEVEL", "CHOSEN"] as const;
export type IndicatorPlaceScope = (typeof INDICATOR_PLACE_SCOPES)[number];
export const isIndicatorPlaceScope = (v: unknown): v is IndicatorPlaceScope => typeof v === "string" && (INDICATOR_PLACE_SCOPES as readonly string[]).includes(v);

export const CHOSEN_PLACES_MAX = 50;

export interface IndicatorPlaceSetting {
  scope: IndicatorPlaceScope;
  level?: AdminLevel | null | undefined;
  placeIds?: readonly string[] | undefined;
}

/** The setting an indicator stored before Phase 56 reads as: record-by-place with a level is LEVEL; otherwise PROJECT. */
export function placeSettingOf(indicator: { placeScope?: string | null | undefined; recordByPlace?: boolean; placeLevel?: number | null | undefined; placeIds?: readonly string[] | null | undefined }): IndicatorPlaceSetting {
  const level = isAdminLevel(indicator.placeLevel) ? indicator.placeLevel : null;
  if (isIndicatorPlaceScope(indicator.placeScope) && indicator.placeScope !== "PROJECT") {
    return { scope: indicator.placeScope, level, placeIds: indicator.placeIds ?? [] };
  }
  if (indicator.recordByPlace) return { scope: "LEVEL", level, placeIds: [] };
  return { scope: "PROJECT" };
}

/** The one check for a setting. LEVEL needs a level; CHOSEN needs between one and CHOSEN_PLACES_MAX live places (merges followed). */
export function checkPlaceSetting(setting: IndicatorPlaceSetting, tree: PlaceTree): Result<IndicatorPlaceSetting, DomainError> {
  if (setting.scope === "PROJECT") return ok({ scope: "PROJECT" });
  if (setting.scope === "LEVEL") {
    if (!isAdminLevel(setting.level) || setting.level === 0) return err(DomainError.validation("Choose the level this is measured at", { field: "placeLevel" }));
    return ok({ scope: "LEVEL", level: setting.level, placeIds: [] });
  }
  const ids: string[] = [];
  for (const raw of setting.placeIds ?? []) {
    const id = tree.current(raw);
    if (!id || !tree.isLive(id)) return err(DomainError.validation("Choose places that are in your list", { field: "placeIds" }));
    if (!ids.includes(id)) ids.push(id);
  }
  if (ids.length === 0) return err(DomainError.validation("Choose at least one place", { field: "placeIds" }));
  if (ids.length > CHOSEN_PLACES_MAX) return err(DomainError.validation(`At most ${CHOSEN_PLACES_MAX} places`, { field: "placeIds" }));
  return ok({ scope: "CHOSEN", level: null, placeIds: ids });
}

export interface EntryRow { placeId: string; name: string; path: string }

/**
 * The rows a by-place entry shows. LEVEL: the open footprint's places at that level (the area itself when it is at the level, or its places
 * below); CHOSEN: the chosen places in order. Places that already hold a figure for this value are always kept (`withFigures`) even when no
 * longer in the footprint, so nothing recorded disappears from the form.
 */
export function entryRows(setting: IndicatorPlaceSetting, areas: readonly ProjectAreaRecord[], tree: PlaceTree, withFigures: readonly string[] = []): EntryRow[] {
  const row = (id: string): EntryRow | null => { const p = tree.get(id); return p ? { placeId: p.id, name: p.name, path: tree.path(p.id) } : null; };
  const ids: string[] = [];
  if (setting.scope === "CHOSEN") ids.push(...(setting.placeIds ?? []).map((i) => tree.current(i) ?? i));
  if (setting.scope === "LEVEL" && isAdminLevel(setting.level)) {
    for (const id of placesForNewWork(areas, tree)) if (tree.get(id)?.adminLevel === setting.level) ids.push(id);
    ids.sort((a, b) => tree.path(a).localeCompare(tree.path(b)));
  }
  for (const raw of withFigures) { const id = tree.current(raw) ?? raw; if (!ids.includes(id)) ids.push(id); }
  return [...new Set(ids)].map(row).filter((r): r is EntryRow => r !== null);
}

/** The place a LOCATION entry is about: its stored id (merges followed), else a unique name match among `candidates`, else undefined. */
export function placeOfEntry(entry: Pick<DisaggregationEntry, "dimension" | "category" | "placeId">, tree: PlaceTree, candidates: readonly string[]): string | undefined {
  if (entry.dimension !== "LOCATION") return undefined;
  if (entry.placeId) return tree.current(entry.placeId);
  const key = normalizeLocationKey(entry.category);
  if (!key) return undefined;
  const hits = candidates.map((c) => tree.get(c)).filter((p) => !!p && (normalizeLocationKey(p.name) === key || p.aliases.some((a) => normalizeLocationKey(a) === key)));
  const unique = [...new Set(hits.map((p) => p!.id))];
  return unique.length === 1 ? unique[0] : undefined;
}

/** By-place figures as breakdown entries: id and name together, an empty box left out (never stored as 0). */
export function placeFigureEntries(figures: ReadonlyArray<{ placeId: string; name: string; value: string }>): DisaggregationEntry[] {
  return figures.filter((f) => f.value.trim() !== "").map((f) => ({ dimension: "LOCATION" as const, category: f.name, value: f.value.trim(), placeId: f.placeId }));
}

/** Gives older name-only LOCATION entries their place id where the match is unique; entries already carrying one, or ambiguous, are left. */
export function withPlaceIds(entries: readonly DisaggregationEntry[], tree: PlaceTree, candidates: readonly string[]): { entries: DisaggregationEntry[]; added: number } {
  let added = 0;
  const out = entries.map((e) => {
    if (e.dimension !== "LOCATION" || e.placeId) return e;
    const id = placeOfEntry(e, tree, candidates);
    if (!id) return e;
    added += 1;
    return { ...e, placeId: id };
  });
  return { entries: out, added };
}
