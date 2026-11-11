/**
 * Where each figure card on a map points (Phase 50.3d): the place's own pin when it has one, else the middle of the drawn area that
 * joined to it. A card whose place has neither is left out (never placed at a guess) and counted, so the screen can say so.
 */
import { normalizeLocationKey } from "@donordesk/domain/contexts/workplan/index.js";
import { geometryBounds } from "../model/bounds.ts";
import type { JoinedUnit } from "../boundaries/join.ts";

export interface AnchorPlace { id: string; name: string; aliases?: readonly string[]; latitude?: number | null | undefined; longitude?: number | null | undefined }

export function calloutAnchors<C extends { key: string; placeKey?: string | undefined }>(cards: readonly C[], places: readonly AnchorPlace[], joined: readonly JoinedUnit[]): { placed: Array<C & { lng: number; lat: number }>; unplaced: number } {
  const byKey = new Map<string, AnchorPlace>();
  for (const p of places) for (const w of [p.name, ...(p.aliases ?? [])]) { const k = normalizeLocationKey(w); if (k && !byKey.has(k)) byKey.set(k, p); }
  const unitOf = new Map(joined.filter((j) => j.placeId).map((j) => [j.placeId!, j]));
  const placed: Array<C & { lng: number; lat: number }> = [];
  let unplaced = 0;
  for (const c of cards) {
    const where = c.placeKey ?? c.key;
    const p = byKey.get(normalizeLocationKey(where));
    if (p && typeof p.latitude === "number" && typeof p.longitude === "number") { placed.push({ ...c, lng: p.longitude, lat: p.latitude }); continue; }
    const unit = p ? unitOf.get(p.id) : joined.find((j) => normalizeLocationKey(j.unit.name) === normalizeLocationKey(where));
    const b = unit ? geometryBounds(unit.unit.geometry) : null;
    if (b) placed.push({ ...c, lng: (b[0] + b[2]) / 2, lat: (b[1] + b[3]) / 2 }); else unplaced += 1;
  }
  return { placed, unplaced };
}
