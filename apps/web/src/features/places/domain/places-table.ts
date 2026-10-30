/** The places table: search, level filter, chosen columns and the CSV of what is shown. Pure. */
import type { PlaceItem } from "../../../lib/server/schemas-places.ts";

export type PlaceColumn = "path" | "level" | "aliases" | "code" | "pin" | "latitude" | "longitude" | "inside";

export const PLACE_COLUMNS: ReadonlyArray<{ key: PlaceColumn; label: string }> = [
  { key: "path", label: "Path" }, { key: "level", label: "Level" }, { key: "aliases", label: "Also known as" }, { key: "code", label: "Code" },
  { key: "pin", label: "Has a pin" }, { key: "latitude", label: "Latitude" }, { key: "longitude", label: "Longitude" }, { key: "inside", label: "Places inside" },
];
export const DEFAULT_PLACE_COLUMNS: readonly PlaceColumn[] = ["level", "aliases"];

const fold = (s: string): string => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export interface PlaceFilter { query: string; level: number | null; pinnedOnly: boolean }

export function filterPlaces(places: readonly PlaceItem[], f: PlaceFilter): PlaceItem[] {
  const q = fold(f.query.trim());
  return places.filter((p) => {
    if (f.level !== null && p.adminLevel !== f.level) return false;
    if (f.pinnedOnly && (p.latitude === undefined || p.longitude === undefined)) return false;
    if (!q) return true;
    return [p.name, p.path, p.code ?? "", ...p.aliases].some((t) => fold(t).includes(q));
  });
}

export function cellFor(p: PlaceItem, column: PlaceColumn, levelLabel: (level: number) => string): string {
  switch (column) {
    case "path": return p.path;
    case "level": return levelLabel(p.adminLevel);
    case "aliases": return p.aliases.join("; ");
    case "code": return p.code ?? "";
    case "pin": return p.latitude !== undefined && p.longitude !== undefined ? "Yes" : "No";
    case "latitude": return p.latitude === undefined ? "" : String(p.latitude);
    case "longitude": return p.longitude === undefined ? "" : String(p.longitude);
    case "inside": return String(p.childCount);
  }
}

/** The CSV of the rows shown, with the chosen columns after the name. A leading = + - @ is defused. */
export function placesCsv(places: readonly PlaceItem[], columns: readonly PlaceColumn[], levelLabel: (level: number) => string): string {
  const cell = (v: string) => `"${(/^[=+\-@]/.test(v) ? `'${v}` : v).replace(/"/g, '""')}"`;
  const head = ["Name", ...columns.map((c) => PLACE_COLUMNS.find((x) => x.key === c)?.label ?? c)];
  return [head, ...places.map((p) => [p.name, ...columns.map((c) => cellFor(p, c, levelLabel))])].map((r) => r.map(cell).join(",")).join("\n");
}
