import { number, text } from "../proposed-item.js";
import { parseLists, valueKey } from "../list-area.js";
import { mergeLists } from "../extractor-shared.js";
import type { AreaExtractionSpec } from "../area-spec.js";
import type { PlaceDef } from "@donordesk/domain";

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

export const PLACES_SPEC: AreaExtractionSpec = {
  area: "PLACES",
  promptVersion: "setup-places-v3",
  sectionTitles: ["geographic", "geographical", "target area", "target areas", "location", "locations", "project sites", "coverage", "area of intervention", "catchment", "beneficiaries", "zone d'intervention", "zones d'intervention", "area de intervencion", "cobertura", "ubicacion"],
  readsFrom: ["PROPOSAL", "LOGFRAME_MATRIX", "INDICATOR_TABLE"],
  budgetChars: 16_000,
  keywords: ["district", "province", "region", "state", "county", "village", "site", "location", "camp", "municipality", "target area", "governorate"],
  instructions: [
    "Extract the places where the project works. Answer:",
    '{"places": [{"name": "...", "adminLevel": 0, "parentName": "...", "latitude": null, "longitude": null, "quote": "...", "block": N, "confidence": "..."}]}',
    "adminLevel: 0 country, 1 province/region/state, 2 district, 3 sub-district, 4 site or village, only when the document makes the level clear.",
    "parentName is the larger area the document places it in. Coordinates only when the document writes them.",
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
  merge: mergeLists(valueKey("name", "parentName"), "places"),
};
