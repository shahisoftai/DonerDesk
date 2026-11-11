/**
 * Counts a card can show (Phase 50.3): places reached at a level, donors, implementing partners, facilities by type. One table says
 * what each count is and what it needs; `computeCount` turns the facts a reader gathered into the figure. Pure: no clock, no server.
 *
 * Honesty: a count whose facts could not be read is "Not available here" (a share link, a missing permission), never 0; a count of
 * facts that exist but are none is a real 0 only when the reader says it looked ("checked"); otherwise it is "Not recorded yet".
 */
export const COUNT_METRICS = {
  PLACES_REACHED: { label: "Places reached", unit: "places", needsLevel: true, needsFacilityType: false, viaShareLink: true },
  DONORS: { label: "Donors", unit: "donors", needsLevel: false, needsFacilityType: false, viaShareLink: false },
  PARTNERS: { label: "Implementing partners", unit: "partners", needsLevel: false, needsFacilityType: false, viaShareLink: false },
  FACILITIES: { label: "Facilities", unit: "facilities", needsLevel: false, needsFacilityType: true, viaShareLink: true },
} as const;
export type CountMetricKey = keyof typeof COUNT_METRICS;
export const COUNT_METRIC_KEYS = Object.keys(COUNT_METRICS) as CountMetricKey[];

export interface CountQuery { metric: CountMetricKey; level?: number | undefined; facilityType?: string | undefined; placeKey?: string | undefined }

/**
 * What a reader gathered. Each list is absent when it could not be read for this viewer. `placesWithValues` are places (with their
 * admin level and the keys of the places above them) that hold a recorded value in the range; `facilities` carry their type and the
 * keys of the places they sit in.
 */
export interface CountFacts {
  placesWithValues?: ReadonlyArray<{ key: string; level: number; within: readonly string[] }> | undefined;
  donors?: ReadonlyArray<{ name: string; placeKeys?: readonly string[] }> | undefined;
  partners?: ReadonlyArray<{ name: string; placeKeys?: readonly string[] }> | undefined;
  facilities?: ReadonlyArray<{ key: string; type: string | null; within: readonly string[] }> | undefined;
}

export interface CountFigure { value: number | null; unit: string; note: string | null }

const distinct = (names: Iterable<string>): number => new Set([...names].map((n) => n.trim().toLowerCase()).filter(Boolean)).size;
const inPlace = (placeKey: string | undefined, keys: readonly string[] | undefined): boolean => placeKey === undefined || (keys ?? []).includes(placeKey);

export function computeCount(q: CountQuery, facts: CountFacts): CountFigure {
  const info = COUNT_METRICS[q.metric];
  const none = (note: string): CountFigure => ({ value: null, unit: info.unit, note });
  switch (q.metric) {
    case "PLACES_REACHED": {
      if (!facts.placesWithValues) return none("Not available here");
      const level = q.level ?? 2;
      const hit = facts.placesWithValues.filter((p) => p.level === level && (q.placeKey === undefined || p.key === q.placeKey || p.within.includes(q.placeKey)));
      return { value: distinct(hit.map((p) => p.key)), unit: info.unit, note: null };
    }
    case "DONORS":
    case "PARTNERS": {
      const list = q.metric === "DONORS" ? facts.donors : facts.partners;
      if (!list) return none("Not available here");
      if (list.length === 0) return none("Not recorded yet");
      return { value: distinct(list.filter((d) => inPlace(q.placeKey, d.placeKeys)).map((d) => d.name)), unit: info.unit, note: null };
    }
    case "FACILITIES": {
      if (!facts.facilities) return none("Not available here");
      const typed = facts.facilities.filter((f) => q.facilityType === undefined || f.type === q.facilityType);
      if (facts.facilities.every((f) => f.type === null) && q.facilityType !== undefined) return none("No facility has a type yet");
      return { value: distinct(typed.filter((f) => q.placeKey === undefined || f.within.includes(q.placeKey)).map((f) => f.key)), unit: info.unit, note: null };
    }
  }
}

export function validateCountQuery(q: CountQuery): string | null {
  const info = COUNT_METRICS[q.metric as CountMetricKey];
  if (!info) return "That count is not one a card can show.";
  if (q.level !== undefined && (!info.needsLevel || !Number.isInteger(q.level) || q.level < 0 || q.level > 4)) return "Only places reached take a level, from 0 (country) to 4 (site).";
  if (q.facilityType !== undefined && (!info.needsFacilityType || !q.facilityType.trim() || q.facilityType.length > 40)) return "Only a facility count takes a facility type.";
  return null;
}
