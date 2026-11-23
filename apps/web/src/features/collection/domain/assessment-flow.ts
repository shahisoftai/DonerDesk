/**
 * The pure rules of starting an assessment (Phase 62.5): which facilities to offer and in what order, and how a draft's state is worded.
 * Facilities given to the person come first (soonest due first), then the others by name; typing narrows by name or by where it sits.
 */
export interface FacilityChoice { id: string; name: string; path: string }
export interface FacilityAssignment { placeId: string; status: string; dueOn?: string | undefined }

const fold = (text: string): string => text.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

export interface OfferedFacility extends FacilityChoice { assigned: boolean; status?: string; dueOn?: string }

export function offerFacilities(places: ReadonlyArray<FacilityChoice>, assignments: ReadonlyArray<FacilityAssignment>, typed: string, limit = 60): OfferedFacility[] {
  const mine = new Map(assignments.filter((a) => a.status === "TO_DO" || a.status === "IN_PROGRESS").map((a) => [a.placeId, a]));
  const q = fold(typed);
  const matches = (p: FacilityChoice): boolean => q === "" || fold(p.name).includes(q) || fold(p.path).includes(q);
  const offered = places.filter(matches).map((p): OfferedFacility => {
    const a = mine.get(p.id);
    return { ...p, assigned: a !== undefined, ...(a ? { status: a.status } : {}), ...(a?.dueOn ? { dueOn: a.dueOn } : {}) };
  });
  offered.sort((x, y) => Number(y.assigned) - Number(x.assigned) || (x.dueOn ?? "9999").localeCompare(y.dueOn ?? "9999") || x.name.localeCompare(y.name));
  return offered.slice(0, limit);
}

/** The places a form of this subject may be about: a facility form only facilities, any other form any place. */
export const placesForSubject = <T extends { facility?: boolean | undefined }>(places: ReadonlyArray<T>, subject: "FACILITY" | "PLACE" | "NONE" | undefined): T[] =>
  subject === "FACILITY" ? places.filter((p) => p.facility === true) : [...places];

export type DraftLine = { kind: "NONE" } | { kind: "SAVING" } | { kind: "SAVED"; at: string } | { kind: "OFFLINE" } | { kind: "CONFLICT" } | { kind: "ERROR"; message: string };
