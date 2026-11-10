/**
 * What is near what (Phase 49.7). Pure. Only places with a pin take part; the rest are counted, never placed at a guess.
 */
import { distanceKm, ringProblem, type LngLat, type RingProblem } from "./distance.js";

export interface PinnedThing extends LngLat { id: string; name: string }
export interface MaybePinned { id: string; name: string; lng?: number | undefined; lat?: number | undefined }

const pinnedOf = <T extends MaybePinned>(xs: readonly T[]): { pinned: Array<T & LngLat>; unpinned: number } => {
  const pinned = xs.filter((x): x is T & LngLat => typeof x.lng === "number" && typeof x.lat === "number" && Number.isFinite(x.lng) && Number.isFinite(x.lat));
  return { pinned, unpinned: xs.length - pinned.length };
};

/** Things within `km` of any of the centres, nearest first, each with its distance to the nearest centre. */
export function withinRings(centres: readonly LngLat[], km: number, things: readonly MaybePinned[]): { ok: true; inside: Array<{ id: string; name: string; km: number }>; unpinned: number } | { ok: false; problem: RingProblem } {
  for (const c of centres) { const p = ringProblem(c, km); if (p) return { ok: false, problem: p }; }
  const { pinned, unpinned } = pinnedOf(things);
  const inside = pinned
    .map((t) => ({ id: t.id, name: t.name, km: Math.min(...centres.map((c) => distanceKm(c, t))) }))
    .filter((t) => t.km <= km)
    .sort((a, b) => a.km - b.km || a.name.localeCompare(b.name))
    .map((t) => ({ ...t, km: Math.round(t.km * 100) / 100 }));
  return { ok: true, inside, unpinned };
}

export interface NearestRow { siteId: string; siteName: string; facilityId: string | null; facilityName: string | null; /** Straight line; null when there is no facility to measure to. */ km: number | null }

/** For each pinned site, the nearest pinned facility in a straight line. With no facility every row says so (null), never 0. */
export function nearestFacility(sites: readonly MaybePinned[], facilities: readonly MaybePinned[]): { rows: NearestRow[]; sitesUnpinned: number; facilitiesUnpinned: number } {
  const s = pinnedOf(sites), f = pinnedOf(facilities);
  const rows = s.pinned.map((site): NearestRow => {
    let best: (MaybePinned & LngLat) | null = null, bestKm = Infinity;
    for (const fac of f.pinned) { if (fac.id === site.id) continue; const d = distanceKm(site, fac); if (d < bestKm) { bestKm = d; best = fac; } }
    return { siteId: site.id, siteName: site.name, facilityId: best?.id ?? null, facilityName: best?.name ?? null, km: best ? Math.round(bestKm * 100) / 100 : null };
  });
  rows.sort((a, b) => (b.km ?? -1) - (a.km ?? -1) || a.siteName.localeCompare(b.siteName));
  return { rows, sitesUnpinned: s.unpinned, facilitiesUnpinned: f.unpinned };
}
