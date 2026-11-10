/**
 * Population inside rings, from a grid of people per cell (Phase 49.7). Pure. The grid is WorldPop's 100 m counts summed to about 1 km
 * (`scripts/maps/build-population-grid.sh`); a cell counts when its centre lies inside a ring, and a cell inside two rings counts once.
 * No data is null with a reason, never 0; the answer always names its source and year and how coarse the cells are.
 */
import { distanceKm, ringBox, ringProblem, type LngLat, type RingProblem } from "./distance.js";

export interface PopulationGrid {
  /** West and north edges of the grid, and the cell size, in degrees. */
  west: number; north: number; cellDeg: number;
  cols: number; rows: number;
  /** Row-major from the north-west cell; a negative or non-finite value is "no data". */
  values: Float32Array | readonly number[];
  source: string; year: string;
}

export type PopulationAnswer =
  | { ok: true; people: number; cellsCounted: number; cellsWithoutData: number; cellKm: number; source: string; year: string }
  | { ok: false; reason: RingProblem | "NO_GRID" | "OUTSIDE_GRID" };

export function populationWithin(grid: PopulationGrid | null, rings: ReadonlyArray<{ centre: LngLat; km: number }>): PopulationAnswer {
  if (!grid) return { ok: false, reason: "NO_GRID" };
  for (const r of rings) { const p = ringProblem(r.centre, r.km); if (p) return { ok: false, reason: p }; }
  const seen = new Set<number>();
  let people = 0, counted = 0, missing = 0, touched = false;
  for (const ring of rings) {
    const [w, s, e, n] = ringBox(ring.centre, ring.km);
    const c0 = Math.max(0, Math.floor((w - grid.west) / grid.cellDeg)), c1 = Math.min(grid.cols - 1, Math.floor((e - grid.west) / grid.cellDeg));
    const r0 = Math.max(0, Math.floor((grid.north - n) / grid.cellDeg)), r1 = Math.min(grid.rows - 1, Math.floor((grid.north - s) / grid.cellDeg));
    for (let row = r0; row <= r1; row++) {
      for (let col = c0; col <= c1; col++) {
        const idx = row * grid.cols + col;
        if (seen.has(idx)) continue;
        const centre = { lng: grid.west + (col + 0.5) * grid.cellDeg, lat: grid.north - (row + 0.5) * grid.cellDeg };
        if (distanceKm(ring.centre, centre) > ring.km) continue;
        seen.add(idx);
        touched = true;
        const v = Number(grid.values[idx]);
        if (Number.isFinite(v) && v >= 0) { people += v; counted++; } else missing++;
      }
    }
  }
  if (!touched) return { ok: false, reason: "OUTSIDE_GRID" };
  const cellKm = Math.round(grid.cellDeg * 111.32 * 10) / 10;
  return { ok: true, people: Math.round(people), cellsCounted: counted, cellsWithoutData: missing, cellKm, source: grid.source, year: grid.year };
}

/**
 * People reached as a share of the people living there (Phase 49.7): only a count of unique people reached, never a rate and never a sum of
 * rates; no population or a population of zero gives null. A share above 100% is returned as it is and flagged (the two figures disagree).
 */
export function coverageShare(uniqueReached: number | null, population: number | null): { percent: number; aboveHundred: boolean } | null {
  if (uniqueReached === null || population === null || !Number.isFinite(uniqueReached) || !Number.isFinite(population) || population <= 0 || uniqueReached < 0) return null;
  const percent = Math.round((uniqueReached / population) * 1000) / 10;
  return { percent, aboveHundred: percent > 100 };
}
