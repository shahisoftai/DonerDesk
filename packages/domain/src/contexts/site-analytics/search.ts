import type { SearchRow } from "./stats-report.js";

/** Clicks over impressions; null with no impressions (an unseen result has no rate, not a rate of 0). */
export function clickRate(clicks: number, impressions: number): number | null {
  return impressions > 0 ? clicks / impressions : null;
}

/**
 * One row of a Search Console table. The position is Google's own average and is only meaningful with impressions,
 * so it is dropped (null) without them.
 */
export function searchRow(name: string, clicks: number, impressions: number, position: number | null | undefined): SearchRow {
  return {
    name: name.trim() === "" ? "Not known" : name,
    clicks,
    impressions,
    ctr: clickRate(clicks, impressions),
    position: impressions > 0 && typeof position === "number" && position > 0 ? position : null,
  };
}

/** Most clicks first, then most impressions, at most `limit`. */
export function topSearchRows(rows: readonly SearchRow[], limit: number): SearchRow[] {
  return [...rows].sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions || a.name.localeCompare(b.name)).slice(0, limit);
}
