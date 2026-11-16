/**
 * Place-first entry on the Record sheet (Phase 57). Pure: built from the same pack data online and offline, so the form behaves the same
 * with no signal. The person picks a place once and a day (the period follows from the day); the sheet then shows the person's planned
 * work at that place and every indicator measured there with its current figure. What is typed is checked here before it is sent;
 * the server merges each cell into its value, so two people at two places never overwrite each other.
 */
import type { PackEntryPlace, PackIndicator, PackIndicatorPlace, PackPlanItem } from "../../offline/domain/offline-pack.ts";

export interface PlaceFirstCell {
  indicatorId: string;
  code: string;
  name: string;
  unit?: string | undefined;
  type: string;
  /** The stored figure ("" = nothing recorded, never 0). */
  stored: string;
  locked: boolean;
  /** Why it is locked (VERIFIED, CALCULATED, PERIOD_LOCKED, NOT_APPLICABLE), when the source says. */
  lockReason?: string | undefined;
  /** A count or money: the places make the total. A rate is recorded as it is. */
  adds: boolean;
}

export interface PlaceFirstAgenda {
  activities: PackPlanItem[];
  cells: PlaceFirstCell[];
}

const ADDS = new Set(["NUMBER", "CURRENCY"]);
const OPEN = new Set(["PLANNED", "IN_PROGRESS"]);

/** A place and the places inside it, from the paths ("Village › Town › District"): a child's path ends with its parent's. */
export function insidePlace(place: PackEntryPlace, candidate: { placeId: string; path?: string }, all: readonly PackEntryPlace[]): boolean {
  if (candidate.placeId === place.placeId) return true;
  const path = candidate.path ?? all.find((p) => p.placeId === candidate.placeId)?.path;
  return !!path && path.endsWith(` › ${place.path}`);
}

/** The places to choose from, filtered by what is typed (name or any part of the path), the remembered one first. */
export function filterPlaces(places: readonly PackEntryPlace[], query: string, recent?: string | undefined): PackEntryPlace[] {
  const q = query.trim().toLowerCase();
  const hits = q ? places.filter((p) => p.path.toLowerCase().includes(q)) : [...places];
  return hits.sort((a, b) => Number(b.placeId === recent) - Number(a.placeId === recent) || a.path.localeCompare(b.path));
}

export function placeFirstAgenda(input: {
  place: PackEntryPlace;
  period: { id: string; startDate: string; endDate: string };
  places: readonly PackEntryPlace[];
  indicators: readonly PackIndicator[];
  indicatorPlaces: readonly PackIndicatorPlace[];
  /** The current cells of this place in this period (from the pack or the server). */
  cells: ReadonlyArray<{ indicatorId: string; value: string; locked: boolean; lockReason?: string | undefined }>;
  plan: readonly PackPlanItem[];
}): PlaceFirstAgenda {
  const { place, period } = input;
  const activities = input.plan
    .filter((p) => OPEN.has(p.status) && p.plannedStart <= period.endDate && p.plannedEnd >= period.startDate)
    .filter((p) => (p.placeIds ?? []).some((id) => insidePlace(place, { placeId: id }, input.places)))
    .sort((a, b) => a.plannedEnd.localeCompare(b.plannedEnd) || a.title.localeCompare(b.title));
  const cellOf = new Map(input.cells.map((c) => [c.indicatorId, c]));
  const measuredHere = new Set(input.cells.map((c) => c.indicatorId));
  const cells: PlaceFirstCell[] = input.indicatorPlaces
    .filter((ip) => measuredHere.has(ip.indicatorId))
    .map((ip) => input.indicators.find((i) => i.id === ip.indicatorId))
    .filter((i): i is PackIndicator => !!i)
    .map((i) => ({ indicatorId: i.id, code: i.code, name: i.name, unit: i.unit, type: i.type, stored: cellOf.get(i.id)?.value ?? "", locked: cellOf.get(i.id)?.locked ?? false, lockReason: cellOf.get(i.id)?.lockReason, adds: ADDS.has(i.type) }))
    // Empty and open first: what still needs doing is at the top.
    .sort((a, b) => Number(a.locked) - Number(b.locked) || Number(a.stored !== "") - Number(b.stored !== "") || a.code.localeCompare(b.code, undefined, { numeric: true }));
  return { activities, cells };
}

const NUMBER = /^-?\d+(\.\d+)?$/;

export interface SplitRow { dimension: string; category: string; value: string }

/** Why a typed cell cannot be sent, as a catalogue key and its values (null = fine). An empty box is fine: it is not 0. */
export function cellProblem(typed: string, cell: Pick<PlaceFirstCell, "type">, splits: readonly SplitRow[] = []): { key: "placeEntry.notNumber" | "placeEntry.splitMismatch"; params?: Record<string, string> } | null {
  const v = typed.replace(/[,\s]/g, "");
  if (v === "") return null;
  if (cell.type !== "TEXT" && cell.type !== "YES_NO" && cell.type !== "CUSTOM" && !NUMBER.test(v)) return { key: "placeEntry.notNumber" };
  const filled = splits.filter((s) => s.value.trim() !== "");
  if (filled.length && ADDS.has(cell.type)) {
    const sum = filled.reduce((a, s) => a + Number(s.value.replace(/[,\s]/g, "") || 0), 0);
    if (Math.abs(sum - Number(v)) > 1e-9) return { key: "placeEntry.splitMismatch", params: { sum: String(sum), total: v } };
  }
  return null;
}

/** The cells to send: only those that changed (typed differs from stored, or a split was entered), never a locked one. */
export function changedCells(cells: readonly PlaceFirstCell[], typed: ReadonlyMap<string, string>, splits: ReadonlyMap<string, readonly SplitRow[]>): Array<{ indicatorId: string; value: string; expected: string; splits?: SplitRow[] }> {
  const out: Array<{ indicatorId: string; value: string; expected: string; splits?: SplitRow[] }> = [];
  for (const c of cells) {
    if (c.locked) continue;
    const value = (typed.get(c.indicatorId) ?? c.stored).replace(/[,\s]/g, "");
    const split = (splits.get(c.indicatorId) ?? []).filter((s) => s.category.trim() && s.value.trim());
    if (value === c.stored.replace(/[,\s]/g, "") && split.length === 0) continue;
    out.push({ indicatorId: c.indicatorId, value, expected: c.stored, ...(split.length ? { splits: split.map((s) => ({ dimension: s.dimension, category: s.category.trim(), value: s.value.trim() })) } : {}) });
  }
  return out;
}

/** The place used last, remembered per device and per project (read defensively: a bad value is "nothing remembered"). */
export const PLACE_FIRST_PREFS_KEY = "donordesk-place-first";

export function parsePlacePrefs(text: string | null | undefined): Record<string, string> {
  if (!text) return {};
  try {
    const raw = JSON.parse(text) as unknown;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    return Object.fromEntries(Object.entries(raw as Record<string, unknown>).filter((e): e is [string, string] => typeof e[1] === "string" && e[0].length <= 80 && e[1].length <= 100).slice(0, 50));
  } catch {
    return {};
  }
}
