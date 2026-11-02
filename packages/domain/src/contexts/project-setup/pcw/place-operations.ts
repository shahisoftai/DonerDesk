/**
 * Edits to the places list (Phase 38.4): the pure operations the Places slide makes on the proposal. A place a person adds or
 * changes is theirs (EDITED, no quote). Nothing is guessed: a name the gazetteer may know is only suggested on the screen, the
 * level is chosen by the person, and a parent must be a place already on the list and sit above the child. One operation is
 * one row in `PLACE_OPERATIONS`, typed so a kind without a handler does not compile.
 */
import { normalizeLocationKey } from "../../workplan/location-key.js";
import { ADMIN_LEVELS } from "../../places/place.js";
import type { PlaceDef, ProjectSetupProposal, Proposed } from "../proposal.js";

export type PlaceOperation =
  | { kind: "ADD_PLACE"; name: string; adminLevel?: number | null; parentName?: string | null }
  | { kind: "EDIT_PLACE"; path: string; patch: Partial<Pick<PlaceDef, "name" | "adminLevel" | "parentName">> };

export type PlaceOperationResult = { ok: true; proposal: ProjectSetupProposal } | { ok: false; reason: string };

type Handler<K extends PlaceOperation["kind"]> = (p: ProjectSetupProposal, op: Extract<PlaceOperation, { kind: K }>) => PlaceOperationResult;

const refuse = (reason: string): PlaceOperationResult => ({ ok: false, reason });
const clean = (v: string | null | undefined, max: number): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const live = (p: ProjectSetupProposal) => p.places.filter((x) => x.status !== "REJECTED" && x.value !== null);
const levelOk = (n: number | null | undefined): n is number => typeof n === "number" && (ADMIN_LEVELS as readonly number[]).includes(n);

/** The problem with putting `place` under `parentName`, or null: the parent must be on the list, above the place, and not the place itself. */
function parentProblem(p: ProjectSetupProposal, name: string, level: number | null, parentName: string | null, skipPath?: number): string | null {
  if (!parentName) return null;
  if (normalizeLocationKey(parentName) === normalizeLocationKey(name)) return "A place cannot be inside itself.";
  const parent = live(p).find((x) => normalizeLocationKey(x.value!.name ?? "") === normalizeLocationKey(parentName) && p.places.indexOf(x) !== skipPath);
  if (!parent) return "That parent is not among the project's places. Add it first.";
  const parentLevel = parent.value!.adminLevel;
  if (level !== null && parentLevel !== null && level <= parentLevel) return "A place sits below its parent: choose a smaller kind of place, or another parent.";
  return null;
}

/** The same name under the same parent is one place. */
function duplicate(p: ProjectSetupProposal, name: string, parentName: string | null, skipIndex?: number): boolean {
  const key = normalizeLocationKey(name);
  const parentKey = parentName ? normalizeLocationKey(parentName) : "";
  return p.places.some((x, i) => i !== skipIndex && x.status !== "REJECTED" && x.value !== null && normalizeLocationKey(x.value.name ?? "") === key && (x.value.parentName ? normalizeLocationKey(x.value.parentName) : "") === parentKey);
}

const person = (value: PlaceDef): Proposed<PlaceDef> => ({ value, sourceQuote: null, sourceRef: null, confidence: "HIGH", status: "EDITED" });

export const PLACE_OPERATIONS: { [K in PlaceOperation["kind"]]: Handler<K> } = {
  ADD_PLACE: (p, { name, adminLevel, parentName }) => {
    const n = clean(name, 200);
    if (!n) return refuse("Give the place a name.");
    if (adminLevel !== undefined && adminLevel !== null && !levelOk(adminLevel)) return refuse("Choose what kind of place this is.");
    const level = adminLevel ?? null;
    const parent = clean(parentName, 200);
    const problem = parentProblem(p, n, level, parent);
    if (problem) return refuse(problem);
    if (duplicate(p, n, parent)) return refuse(`${n} is already on the list${parent ? ` under ${parent}` : ""}.`);
    return { ok: true, proposal: { ...p, places: [...p.places, person({ name: n, adminLevel: level, parentName: parent, latitude: null, longitude: null })] } };
  },
  EDIT_PLACE: (p, { path, patch }) => {
    const [head, raw] = path.split(".");
    const index = Number(raw);
    const item = head === "places" && Number.isInteger(index) ? p.places[index] : undefined;
    if (!item || item.status === "REJECTED" || item.value === null) return refuse("That place is not in the project.");
    const next: PlaceDef = { ...item.value };
    if (patch.name !== undefined) { const n = clean(patch.name, 200); if (!n) return refuse("A place needs a name."); next.name = n; }
    if (patch.adminLevel !== undefined) {
      if (patch.adminLevel !== null && !levelOk(patch.adminLevel)) return refuse("Choose what kind of place this is.");
      next.adminLevel = patch.adminLevel;
    }
    if (patch.parentName !== undefined) next.parentName = clean(patch.parentName, 200);
    const problem = parentProblem(p, next.name ?? "", next.adminLevel, next.parentName, index);
    if (problem) return refuse(problem);
    if (duplicate(p, next.name ?? "", next.parentName, index)) return refuse(`${next.name} is already on the list.`);
    // A pin read from a document describes the old place: moving to another name drops it rather than keeping a wrong one.
    if (patch.name !== undefined && next.name !== item.value.name) { next.latitude = null; next.longitude = null; }
    return { ok: true, proposal: { ...p, places: p.places.map((x, i) => (i === index ? { ...x, value: next, status: "EDITED" as const } : x)) } };
  },
};

export function applyPlaceOperation(proposal: ProjectSetupProposal, op: PlaceOperation): PlaceOperationResult {
  const handler = PLACE_OPERATIONS[op.kind] as (p: ProjectSetupProposal, o: PlaceOperation) => PlaceOperationResult;
  return handler(proposal, op);
}
