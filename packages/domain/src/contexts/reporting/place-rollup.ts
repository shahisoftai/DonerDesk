/**
 * Results by place (Phase 33.2): the per-location rows of an indicator read at a chosen level of the
 * organisation's place tree — Rabak's figure counts toward White Nile, and White Nile toward Sudan.
 * Built on `indicatorLocationRows` (what was recorded, by typed location) and `resolvePlace` (what the
 * typed words mean), so nothing is invented:
 *
 * - Additive types (NUMBER, CURRENCY) sum up the tree; a rate, percentage or qualitative value is
 *   shown for the place that recorded it and is **never combined** (a parent with two reporting
 *   children shows none).
 * - A typed location that matches no place, or several, is listed apart — never dropped, never guessed.
 * - A place recorded above the chosen level is listed apart too: a state's figure is not spread over
 *   its localities.
 * - A parent is "partly reported" when places of the level its figures came from exist in the list but
 *   recorded nothing — so a short total is never read as a full one.
 * Pure: no clock, no geo data.
 */
import { decimalAdd, formatDecimal, parseDecimal } from "./indicator-calculator.js";
import type { IndicatorLocationView } from "./location-analytics.js";
import { PlaceRegistry, resolvePlace, type AdminLevel, type PlaceRecord, type ResolveOptions } from "../places/place.js";

export interface PlaceRollupRow {
  placeId: string;
  name: string;
  /** "Rabak › White Nile › Sudan". */
  path: string;
  adminLevel: AdminLevel;
  /** The combined value; null when the type cannot be combined and more than one place reported. */
  value: string | null;
  verified: boolean;
  unverified: number;
  /** How many places (at the level the figures were recorded) contribute. */
  contributors: number;
  /** How many places of that level are listed below this one (reported or not). */
  listedBelow: number;
  partly: boolean;
}

export interface PlaceRollupUnplaced {
  location: string;
  value: string;
  reason: "NOT_IN_LIST" | "MORE_THAN_ONE_PLACE" | "ABOVE_LEVEL";
  /** For MORE_THAN_ONE_PLACE: where each candidate is. */
  candidates?: string[];
}

export interface PlaceRollup {
  level: AdminLevel;
  additive: boolean;
  rows: PlaceRollupRow[];
  unplaced: PlaceRollupUnplaced[];
}

interface Contribution {
  place: PlaceRecord;
  value: string;
  verified: boolean;
  unverified: number;
}

export function rollupByPlace(view: IndicatorLocationView, registry: PlaceRegistry, level: AdminLevel, options: ResolveOptions = {}): PlaceRollup | null {
  if (view.kind === "PROJECT_WIDE") return null;
  const additive = view.kind === "ADDITIVE";
  const contributions: Contribution[] = [];
  const unplaced: PlaceRollupUnplaced[] = [];
  for (const row of view.rows) {
    const r = resolvePlace(row.location, registry, options);
    if (r.status === "UNRESOLVED") { unplaced.push({ location: row.location, value: row.value, reason: "NOT_IN_LIST" }); continue; }
    if (r.status === "AMBIGUOUS") {
      unplaced.push({ location: row.location, value: row.value, reason: "MORE_THAN_ONE_PLACE", candidates: r.candidates.map((c) => registry.pathLabel(c.id)) });
      continue;
    }
    if (r.place.adminLevel < level) { unplaced.push({ location: row.location, value: row.value, reason: "ABOVE_LEVEL" }); continue; }
    contributions.push({ place: r.place, value: row.value, verified: row.verified, unverified: row.unverified });
  }

  // Merge rows that resolved to the same place ("Rabak" and "Rabak locality" are one).
  const perPlace = new Map<string, Contribution>();
  for (const c of contributions) {
    const at = perPlace.get(c.place.id);
    if (!at) { perPlace.set(c.place.id, { ...c }); continue; }
    at.unverified += c.unverified;
    at.verified = at.verified && c.verified;
    if (additive) {
      const a = parseDecimal(at.value);
      const b = parseDecimal(c.value);
      if (a && b) at.value = formatDecimal(decimalAdd(a, b));
    } else at.value = c.value;
  }

  const groups = new Map<string, Contribution[]>();
  for (const c of perPlace.values()) {
    const target = registry.ancestorAtLevel(c.place.id, level);
    if (!target) { unplaced.push({ location: c.place.name, value: c.value, reason: "ABOVE_LEVEL" }); continue; }
    const list = groups.get(target.id);
    if (list) list.push(c);
    else groups.set(target.id, [c]);
  }

  const rows: PlaceRollupRow[] = [];
  for (const [id, parts] of groups) {
    const place = registry.get(id)!;
    const deepest = Math.max(...parts.map((p) => p.place.adminLevel));
    const listed = place.adminLevel === deepest ? 1 : [...registry.descendantIds(id)].filter((d) => registry.get(d)?.adminLevel === deepest).length;
    const contributors = parts.length;
    let value: string | null;
    if (additive) {
      let total = parseDecimal("0");
      for (const p of parts) {
        const d = parseDecimal(p.value);
        if (d && total) total = decimalAdd(total, d);
      }
      value = total ? formatDecimal(total) : null;
    } else value = contributors === 1 ? parts[0]!.value : null;
    rows.push({
      placeId: id, name: place.name, path: registry.pathLabel(id), adminLevel: place.adminLevel, value,
      verified: parts.every((p) => p.verified), unverified: parts.reduce((s, p) => s + p.unverified, 0),
      contributors, listedBelow: listed, partly: contributors < listed,
    });
  }
  rows.sort((a, b) => Number((b.value ?? "").replace(/,/g, "")) - Number((a.value ?? "").replace(/,/g, "")) || a.name.localeCompare(b.name));
  return { level, additive, rows, unplaced };
}
