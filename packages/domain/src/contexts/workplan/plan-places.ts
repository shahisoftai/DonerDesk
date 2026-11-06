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

/** What a place lookup answered; the shape of `resolvePlace`'s answer without importing it (the places context is separate). */
export type PlaceLookup = { status: "RESOLVED"; place: { id: string } } | { status: "AMBIGUOUS" } | { status: "UNRESOLVED" };

/**
 * The places named in a typed location, for the work-plan import: the text is split at ";" and each part is looked up. Only a part that
 * names exactly one place is linked; a part that names none or several is left as typed and reported, never guessed. At most `PLAN_PLACES_MAX`.
 */
export function placesFromLocationText(text: string, lookup: (part: string) => PlaceLookup): { placeIds: string[]; notes: string[] } {
  const placeIds: string[] = [];
  const notes: string[] = [];
  for (const part of text.split(";").map((p) => p.trim()).filter(Boolean)) {
    const found = lookup(part);
    if (found.status === "RESOLVED") { if (!placeIds.includes(found.place.id)) placeIds.push(found.place.id); }
    else if (found.status === "AMBIGUOUS") notes.push(`"${part}" could be more than one place in your list, so it was not linked`);
    else notes.push(`"${part}" is not in your places list, so it was not linked`);
  }
  if (placeIds.length > PLAN_PLACES_MAX) { notes.push(`Only the first ${PLAN_PLACES_MAX} places were linked`); placeIds.length = PLAN_PLACES_MAX; }
  return { placeIds, notes };
}
