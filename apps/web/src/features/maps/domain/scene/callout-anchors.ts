/**
 * Where each card on a map points (Phase 50.3d): the place's own pin when it has one, else the middle of the drawn area that joined to it,
 * else the middle of the pinned places inside it (a district shown on a province map points at its sites). A card whose place has none
 * of these is left out (never placed at a guess) and counted, so the screen can say so.
 */
import { normalizeLocationKey } from "@donordesk/domain/contexts/workplan/index.js";
import { geometryBounds } from "../model/bounds.ts";
import type { JoinedUnit } from "../boundaries/join.ts";

export interface AnchorPlace { id: string; name: string; aliases?: readonly string[]; parentId?: string | null | undefined; latitude?: number | null | undefined; longitude?: number | null | undefined }

export function calloutAnchors<C extends { key: string; placeKey?: string | undefined }>(cards: readonly C[], places: readonly AnchorPlace[], joined: readonly JoinedUnit[]): { placed: Array<C & { lng: number; lat: number }>; unplaced: number } {
  const byKey = new Map<string, AnchorPlace>();
  for (const p of places) for (const w of [p.name, ...(p.aliases ?? [])]) { const k = normalizeLocationKey(w); if (k && !byKey.has(k)) byKey.set(k, p); }
  const unitOf = new Map(joined.filter((j) => j.placeId).map((j) => [j.placeId!, j]));
  const children = new Map<string, AnchorPlace[]>();
  for (const q of places) if (q.parentId) children.set(q.parentId, [...(children.get(q.parentId) ?? []), q]);
  /** The pins of the places inside a place, at any depth (a district's sites). */
  const pinsInside = (id: string, depth = 0): Array<[number, number]> => (depth > 5 ? [] : (children.get(id) ?? []).flatMap((q) => [
    ...(typeof q.latitude === "number" && typeof q.longitude === "number" ? [[q.longitude, q.latitude] as [number, number]] : []),
    ...pinsInside(q.id, depth + 1),
  ]));
  const placed: Array<C & { lng: number; lat: number }> = [];
  let unplaced = 0;
  for (const c of cards) {
    const where = c.placeKey ?? c.key;
    const p = byKey.get(normalizeLocationKey(where));
    if (p && typeof p.latitude === "number" && typeof p.longitude === "number") { placed.push({ ...c, lng: p.longitude, lat: p.latitude }); continue; }
    const unit = p ? unitOf.get(p.id) : joined.find((j) => normalizeLocationKey(j.unit.name) === normalizeLocationKey(where));
    const b = unit ? geometryBounds(unit.unit.geometry) : null;
    if (b) { placed.push({ ...c, lng: (b[0] + b[2]) / 2, lat: (b[1] + b[3]) / 2 }); continue; }
    const inside = p ? pinsInside(p.id) : [];
    if (inside.length) placed.push({ ...c, lng: inside.reduce((a, q) => a + q[0], 0) / inside.length, lat: inside.reduce((a, q) => a + q[1], 0) / inside.length });
    else unplaced += 1;
  }
  return { placed, unplaced };
}
