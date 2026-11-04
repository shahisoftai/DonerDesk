/** The places a planned activity takes place in. Pure: the rule for which places may be linked and how they are told in one line. */
import { DomainError } from "../../core/domain-error.js";
import { err, ok, type Result } from "../../core/result.js";

export const PLAN_PLACES_MAX = 25;

export interface LinkablePlace {
  id: string;
  name: string;
  archived: boolean;
}

/** The places to keep: no repeats (first spelling wins), each one in the list and not retired, at most `PLAN_PLACES_MAX`. */
export function checkPlanPlaces(placeIds: readonly string[], known: readonly LinkablePlace[]): Result<string[], DomainError> {
  const ids = [...new Set(placeIds)];
  if (ids.length > PLAN_PLACES_MAX) return err(DomainError.validation(`An activity can name at most ${PLAN_PLACES_MAX} places`, { field: "placeIds" }));
  const byId = new Map(known.map((p) => [p.id, p]));
  for (const id of ids) {
    const place = byId.get(id);
    if (!place) return err(DomainError.validation("Choose places from your places list", { field: "placeIds" }));
    if (place.archived) return err(DomainError.validation(`${place.name} has been retired; choose another place`, { field: "placeIds" }));
  }
  return ok(ids);
}

/** One line for lists: "Gulu", "Gulu and Kitgum", "Gulu, Kitgum and 2 more". Nothing when there is none. */
export function planPlaceSummary(names: readonly string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0]!;
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  const rest = names.length - 2;
  return `${names[0]}, ${names[1]} and ${rest} more`;
}
