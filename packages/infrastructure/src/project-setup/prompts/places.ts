import { number, text } from "../proposed-item.js";
import { parseLists } from "../list-area.js";
import { PLACES_SCHEMA } from "../output-schemas.js";
import type { AreaExtractionSpec } from "../area-spec.js";
import { normalizeLocationKey, type PlaceDef, type Proposed } from "@donordesk/domain";

const coordinate = (x: unknown, limit: number): number | null => {
  const n = number(x);
  return n !== null && Math.abs(n) <= limit ? n : null;
};

const read = (raw: Record<string, unknown>): PlaceDef | null => {
  const name = text(raw.name);
  if (!name) return null;
  const level = number(raw.adminLevel);
  const latitude = coordinate(raw.latitude, 90);
  const longitude = coordinate(raw.longitude, 180);
  // A pin is both coordinates or neither.
  const pinned = latitude !== null && longitude !== null;
  return {
    name, adminLevel: level !== null && Number.isInteger(level) && level >= 0 && level <= 4 ? level : null,
    parentName: text(raw.parentName), latitude: pinned ? latitude : null, longitude: pinned ? longitude : null,
  };
};

/**
 * One place, one item: names are compared through the map's own normaliser ("Baidoa District" is "Baidoa"), the fuller spelling
 * stays and a missing level or parent is filled from the other. Two different parents mean two different places.
 */
export function mergePlaces(a: Record<string, unknown>, b: Record<string, unknown>): Record<string, unknown> {
  const out: Proposed<PlaceDef>[] = [];
  for (const item of [...(a.places ?? []) as Proposed<PlaceDef>[], ...(b.places ?? []) as Proposed<PlaceDef>[]]) {
    const v = item.value;
    if (!v?.name) continue;
    const key = normalizeLocationKey(v.name);
    const same = out.findIndex((o) => normalizeLocationKey(o.value!.name ?? "") === key && (!o.value!.parentName || !v.parentName || normalizeLocationKey(o.value!.parentName) === normalizeLocationKey(v.parentName)));
    if (same < 0) { out.push(item); continue; }
    const had = out[same]!;
    const fuller = v.name.length > (had.value!.name ?? "").length ? item : had;
    out[same] = { ...fuller, value: { ...fuller.value!, adminLevel: had.value!.adminLevel ?? v.adminLevel, parentName: had.value!.parentName ?? v.parentName, latitude: had.value!.latitude ?? v.latitude, longitude: had.value!.longitude ?? v.longitude } };
  }
  return { ...a, ...b, places: out };
}

export const PLACES_SPEC: AreaExtractionSpec = {
  area: "PLACES",
  promptVersion: "setup-places-v4",
  sectionTitles: ["geographic", "geographical", "target area", "target areas", "location", "locations", "project sites", "coverage", "area of intervention", "catchment", "beneficiaries", "zone d'intervention", "zones d'intervention", "area de intervencion", "cobertura", "ubicacion"],
  readsFrom: ["PROPOSAL", "LOGFRAME_MATRIX", "INDICATOR_TABLE"],
  budgetChars: 16_000,
  keywords: ["district", "province", "region", "state", "county", "village", "site", "location", "camp", "municipality", "target area", "governorate"],
  instructions: [
    "Extract the places where the project works. Answer:",
    '{"places": [{"name": "...", "adminLevel": 0, "parentName": "...", "latitude": null, "longitude": null, "quote": "...", "block": N, "confidence": "..."}]}',
    "adminLevel: 0 country, 1 province/region/state, 2 district, 3 sub-district, 4 site or village. Use the document's wording and your knowledge of the country's geography to decide what the name is; if you are unsure, null.",
    "parentName is the larger area it sits in, from the document or your knowledge of the geography; if you are unsure, null. Coordinates only when the document writes them. The name itself must be in the quote.",
    "List only places where THIS project works. A place named only for a wider programme, the donor's other projects, a headquarters, a referral hospital outside the project area or as background is not a project place; leave it out.",
    "One place is one item: different spellings or names of the same place (\"Baidoa\", \"Baidoa District\", \"Baydhaba\") are a single item under the name a location table uses, or else the most formal one. A path such as \"Somalia > Bay > Baidoa\" gives each level as its own item with its parent; a path that repeats a name gives it once.",
  ].join("\n"),
  context: (prior) => {
    const locations = Array.isArray(prior.plan)
      ? [...new Set(prior.plan.map((i) => (i as { value?: { location?: unknown } }).value?.location).filter((l): l is string => typeof l === "string"))]
      : [];
    return `Locations named by planned activities: ${locations.join("; ") || "none"}.`;
  },
  parse: parseLists({ places: read }),
  schema: PLACES_SCHEMA,
  merge: mergePlaces,
};
