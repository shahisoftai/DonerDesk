/**
 * The organisation's places as files other tools open, and back (Phase 49.5). Pure.
 * CSV uses the columns the places import reads (`place-import.ts`), so exporting and importing again gives the same places.
 * GeoJSON holds the places with a pin (a place without one is counted, never placed at a guess). No figures: places only.
 */
import { csvCell } from "../canvas/export-formats.js";

export interface ExportablePlace {
  id: string;
  name: string;
  adminLevel: number;
  path: string;
  parentId?: string | undefined;
  code?: string | undefined;
  aliases: readonly string[];
  latitude?: number | undefined;
  longitude?: number | undefined;
  facility?: boolean | undefined;
  archived?: boolean | undefined;
}

export const PLACE_EXPORT_COLUMNS = ["Name", "Level", "Parent", "Code", "Latitude", "Longitude", "Other spellings"] as const;

const live = (p: ExportablePlace): boolean => !p.archived;
const pinned = (p: ExportablePlace): boolean => typeof p.latitude === "number" && typeof p.longitude === "number" && Number.isFinite(p.latitude) && Number.isFinite(p.longitude);

/** Parents first, so an import never meets a place before the place it sits inside. */
function inImportOrder(places: readonly ExportablePlace[]): ExportablePlace[] {
  return places.filter(live).sort((a, b) => a.adminLevel - b.adminLevel || a.path.localeCompare(b.path));
}

export function placeListToCsv(places: readonly ExportablePlace[]): string {
  const byId = new Map(places.map((p) => [p.id, p]));
  const rows = inImportOrder(places).map((p) => [
    p.name, `adm${p.adminLevel}`, p.parentId ? byId.get(p.parentId)?.name ?? "" : "", p.code ?? "",
    pinned(p) ? p.latitude! : "", pinned(p) ? p.longitude! : "", p.aliases.join(", "),
  ].map((v) => csvCell(v as string | number)).join(","));
  return [PLACE_EXPORT_COLUMNS.join(","), ...rows].join("\n") + "\n";
}

export function placeListToGeoJson(places: readonly ExportablePlace[]): { text: string; unpinned: number } {
  const kept = inImportOrder(places);
  const features = kept.filter(pinned).map((p) => ({
    type: "Feature" as const,
    id: p.id,
    geometry: { type: "Point" as const, coordinates: [p.longitude!, p.latitude!] },
    properties: { name: p.name, level: p.adminLevel, path: p.path, ...(p.code ? { pcode: p.code } : {}), ...(p.aliases.length > 0 ? { aliases: p.aliases.join(", ") } : {}), ...(p.facility ? { facility: true } : {}) },
  }));
  return { text: JSON.stringify({ type: "FeatureCollection", features }), unpinned: kept.length - features.length };
}

/** A results-by-place row as a file row: a gap stays empty (never 0) and an unverified figure says so. */
export interface PlaceResultRow { placeId: string; name: string; path: string; code?: string | undefined; latitude?: number | undefined; longitude?: number | undefined; value: number | null; verified: boolean; period: string }

export const PLACE_RESULT_COLUMNS = ["Place", "Path", "Code", "Latitude", "Longitude", "Value", "Verified", "Period"] as const;

export function placeResultsToCsv(rows: readonly PlaceResultRow[], valueLabel: string): string {
  const head = PLACE_RESULT_COLUMNS.map((c) => (c === "Value" ? csvCell(valueLabel) : c)).join(",");
  const body = rows.map((r) => [r.name, r.path, r.code ?? "", r.latitude ?? "", r.longitude ?? "", r.value ?? "", r.value === null ? "" : r.verified ? "yes" : "no", r.period].map((v) => csvCell(v as string | number)).join(","));
  return [head, ...body].join("\n") + "\n";
}

export function placeResultsToGeoJson(rows: readonly PlaceResultRow[], valueLabel: string): { text: string; unpinned: number } {
  const withPin = rows.filter((r) => typeof r.latitude === "number" && typeof r.longitude === "number");
  const features = withPin.map((r) => ({
    type: "Feature" as const,
    geometry: { type: "Point" as const, coordinates: [r.longitude!, r.latitude!] },
    properties: { name: r.name, path: r.path, ...(r.code ? { pcode: r.code } : {}), [valueLabel]: r.value, verified: r.value === null ? null : r.verified, period: r.period },
  }));
  return { text: JSON.stringify({ type: "FeatureCollection", features }), unpinned: rows.length - withPin.length };
}
