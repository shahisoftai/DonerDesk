/**
 * Importing a list of places (Phase 33.1): a pasted or uploaded sheet with the columns
 * Name, Level, Parent, Latitude, Longitude, Code, Other spellings. Any row with a problem blocks
 * the whole import and names its row (the work-plan import's rule); a place already listed is
 * skipped, not duplicated. Pure: ids come from the caller.
 */
import { normalizeHeader, splitDelimited } from "../../core/delimited.js";
import { normalizeLocationKey } from "../workplan/location-key.js";
import { ADMIN_LEVEL_LABEL, PlaceRegistry, placeKeys, validatePlace, type AdminLevel, type PlaceRecord } from "./place.js";

export interface PlaceImportRow {
  row: number;
  name: string;
  adminLevel: AdminLevel;
  parentName?: string;
  latitude?: number;
  longitude?: number;
  code?: string;
  aliases: string[];
}

export interface PlaceImportProblem {
  row: number;
  message: string;
}

export interface PlaceImportPlan {
  /** Places to create, parents before children. */
  create: PlaceRecord[];
  /** Rows that name a place already in the list. */
  skipped: Array<{ row: number; name: string }>;
  problems: PlaceImportProblem[];
}

const COLUMN: Record<string, "name" | "level" | "parent" | "latitude" | "longitude" | "code" | "aliases"> = {
  name: "name", place: "name", location: "name",
  level: "level", type: "level", kind: "level", adminlevel: "level",
  parent: "parent", parentplace: "parent", inside: "parent", locatedin: "parent",
  latitude: "latitude", lat: "latitude", longitude: "longitude", lng: "longitude", lon: "longitude", long: "longitude",
  code: "code", placecode: "code", pcode: "code",
  otherspellings: "aliases", aliases: "aliases", alias: "aliases", alsoknownas: "aliases",
};

const LEVEL_WORDS: Array<[AdminLevel, string[]]> = [
  [0, ["country", "nation", "0", "adm0", "admin 0"]],
  [1, ["state", "province", "region", "governorate", "1", "adm1", "admin 1", "state or province"]],
  [2, ["district", "locality", "county", "municipality", "2", "adm2", "admin 2", "district or locality"]],
  [3, ["sub district", "sub-district", "subdistrict", "sub county", "sub-county", "ward", "3", "adm3", "admin 3"]],
  [4, ["community", "village", "site", "facility", "camp", "clinic", "school", "4", "adm4", "admin 4", "community or site"]],
];

export function parseAdminLevel(text: string): AdminLevel | undefined {
  const t = text.trim().toLowerCase();
  for (const [level, words] of LEVEL_WORDS) if (words.includes(t)) return level;
  return undefined;
}

/** Reads the sheet's rows. Does not touch the existing list. A blank line is skipped; a missing Name or Level is a problem. */
export function parsePlaceSheet(text: string): { rows: PlaceImportRow[]; problems: PlaceImportProblem[] } {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/);
  const first = lines.findIndex((l) => l.replace(/[,;\t\s]/g, "") !== "");
  if (first < 0) return { rows: [], problems: [{ row: 1, message: "The sheet is empty" }] };
  const delimiter = lines[first]!.includes("\t") ? "\t" : lines[first]!.split(";").length > lines[first]!.split(",").length ? ";" : ",";
  const header = splitDelimited(lines[first]!, delimiter).map((h) => COLUMN[normalizeHeader(h)]);
  const problems: PlaceImportProblem[] = [];
  if (!header.includes("name")) problems.push({ row: first + 1, message: "The first row must name the columns, and one of them must be Name" });
  if (!header.includes("level")) problems.push({ row: first + 1, message: "A Level column is needed (Country, State or province, District or locality, Sub-district, Community or site)" });
  if (problems.length) return { rows: [], problems };
  const rows: PlaceImportRow[] = [];
  for (let i = first + 1; i < lines.length; i += 1) {
    const line = lines[i]!;
    if (line.replace(/[,;\t\s]/g, "") === "") continue;
    const cells = splitDelimited(line, delimiter);
    const get = (col: string) => (cells[header.indexOf(col as never)] ?? "").trim();
    const row = i + 1;
    const name = get("name");
    if (!name) { problems.push({ row, message: "This row has no name" }); continue; }
    const adminLevel = parseAdminLevel(get("level"));
    if (adminLevel === undefined) { problems.push({ row, message: `"${get("level")}" is not a level for ${name}; use Country, State or province, District or locality, Sub-district or Community or site` }); continue; }
    const lat = get("latitude");
    const lng = get("longitude");
    const latitude = lat === "" ? undefined : Number(lat);
    const longitude = lng === "" ? undefined : Number(lng);
    if ((latitude !== undefined && !Number.isFinite(latitude)) || (longitude !== undefined && !Number.isFinite(longitude))) {
      problems.push({ row, message: `The pin for ${name} is not a number` });
      continue;
    }
    rows.push({
      row, name, adminLevel,
      ...(get("parent") ? { parentName: get("parent") } : {}),
      ...(latitude !== undefined ? { latitude } : {}),
      ...(longitude !== undefined ? { longitude } : {}),
      ...(get("code") ? { code: get("code") } : {}),
      aliases: get("aliases") ? get("aliases").split(/[|;]+/).map((a) => a.trim()).filter(Boolean) : [],
    });
  }
  return { rows, problems };
}

/**
 * Turns parsed rows into places to create. A parent is found among the rows (by name, then its path
 * when several share the name) or in the existing list. Places are created parents-first; a cycle or an
 * unknown parent is a problem on the row that names it.
 */
export function planPlaceImport(rows: readonly PlaceImportRow[], registry: PlaceRegistry, newId: () => string): PlaceImportPlan {
  const problems: PlaceImportProblem[] = [];
  const skipped: PlaceImportPlan["skipped"] = [];
  const keyOwners = new Map<string, number[]>();
  for (const r of rows) {
    const k = normalizeLocationKey(r.name);
    keyOwners.set(k, [...(keyOwners.get(k) ?? []), r.row]);
  }
  const existing = registry.all();
  const created: PlaceRecord[] = [];
  const idByRow = new Map<number, string>();

  const parentOf = (r: PlaceImportRow): { id?: string; row?: number; problem?: string } => {
    if (!r.parentName) return {};
    const key = normalizeLocationKey(r.parentName);
    const inList = registry.withKey(key);
    // A place already in the list wins over a sheet row of the same name (that row is skipped as a repeat).
    const inSheet = inList.length === 1 ? [] : (keyOwners.get(key) ?? []).filter((n) => n !== r.row);
    const total = inSheet.length + inList.length;
    if (total === 0) return { problem: `${r.name}: the parent "${r.parentName}" is not in the sheet or in your places` };
    if (total > 1) return { problem: `${r.name}: "${r.parentName}" is the name of more than one place; make the names in the sheet distinct` };
    return inSheet.length ? { row: inSheet[0] } : { id: inList[0]!.id };
  };

  // Order: a row waits until its parent row has an id.
  const remaining = [...rows];
  let progress = true;
  while (remaining.length && progress) {
    progress = false;
    for (let i = 0; i < remaining.length; i += 1) {
      const r = remaining[i]!;
      const p = parentOf(r);
      if (p.problem) {
        problems.push({ row: r.row, message: p.problem });
        remaining.splice(i, 1);
        i -= 1;
        progress = true;
        continue;
      }
      if (p.row !== undefined && !idByRow.has(p.row)) continue;
      const parentId = p.id ?? (p.row !== undefined ? idByRow.get(p.row) : undefined);
      const sameName = existing.find((e) => (e.parentId ?? "") === (parentId ?? "") && placeKeys(e).includes(normalizeLocationKey(r.name)));
      if (sameName) {
        skipped.push({ row: r.row, name: r.name });
        idByRow.set(r.row, sameName.id);
        remaining.splice(i, 1);
        i -= 1;
        progress = true;
        continue;
      }
      const id = newId();
      const record: PlaceRecord = {
        id, name: r.name, kind: r.latitude !== undefined ? "POINT" : "AREA", adminLevel: r.adminLevel,
        ...(parentId ? { parentId } : {}),
        ...(r.latitude !== undefined ? { latitude: r.latitude } : {}),
        ...(r.longitude !== undefined ? { longitude: r.longitude } : {}),
        ...(r.code ? { code: r.code } : {}),
        aliases: r.aliases, archived: false,
      };
      const valid = validatePlace(record, [...existing, ...created]);
      if (!valid.ok) {
        const level = ADMIN_LEVEL_LABEL[r.adminLevel];
        problems.push({ row: r.row, message: `${r.name} (${level}): ${valid.error.message}` });
      } else {
        created.push(valid.value);
        idByRow.set(r.row, id);
      }
      remaining.splice(i, 1);
      i -= 1;
      progress = true;
    }
  }
  for (const r of remaining) problems.push({ row: r.row, message: `${r.name} sits inside a place that sits inside it; check the Parent column` });
  problems.sort((a, b) => a.row - b.row);
  return { create: problems.length ? [] : created, skipped, problems };
}
