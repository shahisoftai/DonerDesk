/**
 * Places (Phase 33.1): the organisation's own list of where it works. A place is master data — a
 * point (a clinic, a camp) or an area (a state, a locality) with a parent — so a value recorded at
 * Rabak can be read at White Nile state or at the country, and "Gulu", "Gulu District" and "gulu"
 * are one thing. Pure: no clock, no I/O, no bundled geo data (the web layer passes gazetteer hits in
 * as ordinary candidates).
 *
 * Nothing here guesses: text that names no place, or names several, comes back as such.
 */
import { normalizeLocationKey } from "../workplan/location-key.js";
import { DomainError } from "../../core/domain-error.js";
import { err, ok, type Result } from "../../core/result.js";

export type PlaceKind = "POINT" | "AREA";

/** 0 = country, 1 = state/province, 2 = district/locality, 3 = sub-district, 4 = community/site. */
export type AdminLevel = 0 | 1 | 2 | 3 | 4;
export const ADMIN_LEVELS: readonly AdminLevel[] = [0, 1, 2, 3, 4];
export const ADMIN_LEVEL_LABEL: Readonly<Record<AdminLevel, string>> = {
  0: "Country",
  1: "State or province",
  2: "District or locality",
  3: "Sub-district",
  4: "Community or site",
};

export interface PlaceRecord {
  id: string;
  name: string;
  kind: PlaceKind;
  adminLevel: AdminLevel;
  parentId?: string;
  /** ISO-3166 alpha-2 (or a country name) of the country the place lies in; inherited by display only. */
  country?: string;
  latitude?: number;
  longitude?: number;
  aliases: string[];
  /** The organisation's own code (a P-code, a facility id); never required. */
  code?: string;
  /** A place people go to for a service (clinic, school, water point). Optional: absent means not marked. */
  facility?: boolean;
  archived: boolean;
}

export const PLACE_NAME_MAX = 120;
export const PLACE_ALIASES_MAX = 12;

/** Every key the place answers to: its name and each alias, normalised. */
export function placeKeys(place: Pick<PlaceRecord, "name" | "aliases">): string[] {
  const keys = new Set<string>();
  for (const text of [place.name, ...place.aliases]) {
    const key = normalizeLocationKey(text);
    if (key) keys.add(key);
  }
  return [...keys];
}

export function isAdminLevel(value: unknown): value is AdminLevel {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 4;
}

/**
 * The one place a place is checked, for create and edit. A point has a pin or none; an area never
 * carries one (its outline is a map layer's job); coordinates come as a pair and in range; a place
 * sits strictly below its parent and never inside itself; two live places under one parent may not
 * share a key.
 */
export function validatePlace(place: PlaceRecord, existing: readonly PlaceRecord[]): Result<PlaceRecord, DomainError> {
  const name = place.name.trim();
  if (!name) return err(DomainError.validation("A place needs a name", { field: "name" }));
  if (name.length > PLACE_NAME_MAX) return err(DomainError.validation(`A place name is at most ${PLACE_NAME_MAX} characters`, { field: "name" }));
  if (!isAdminLevel(place.adminLevel)) return err(DomainError.validation("Choose what kind of place this is", { field: "adminLevel" }));
  const aliases = [...new Set(place.aliases.map((a) => a.trim()).filter(Boolean))];
  if (aliases.length > PLACE_ALIASES_MAX) return err(DomainError.validation(`At most ${PLACE_ALIASES_MAX} other spellings`, { field: "aliases" }));
  const hasLat = place.latitude !== undefined;
  const hasLng = place.longitude !== undefined;
  if (hasLat !== hasLng) return err(DomainError.validation("A pin needs both latitude and longitude", { field: "latitude" }));
  if (hasLat && (place.latitude! < -90 || place.latitude! > 90 || place.longitude! < -180 || place.longitude! > 180)) {
    return err(DomainError.validation("That pin is outside the map (latitude -90 to 90, longitude -180 to 180)", { field: "latitude" }));
  }
  if (place.kind === "AREA" && hasLat) return err(DomainError.validation("An area has no pin; use a point for a single site", { field: "kind" }));

  const byId = new Map(existing.map((p) => [p.id, p]));
  if (place.parentId) {
    if (place.parentId === place.id) return err(DomainError.validation("A place cannot be inside itself", { field: "parentId" }));
    const parent = byId.get(place.parentId);
    if (!parent || parent.archived) return err(DomainError.validation("Choose a parent place that exists", { field: "parentId" }));
    if (parent.kind === "POINT") return err(DomainError.validation("A point cannot contain other places", { field: "parentId" }));
    if (place.adminLevel <= parent.adminLevel) {
      return err(DomainError.validation(`${ADMIN_LEVEL_LABEL[place.adminLevel]} must sit below ${parent.name} (${ADMIN_LEVEL_LABEL[parent.adminLevel]})`, { field: "adminLevel" }));
    }
    for (let up: PlaceRecord | undefined = parent, guard = 0; up && guard < 10; up = up.parentId ? byId.get(up.parentId) : undefined, guard += 1) {
      if (up.id === place.id) return err(DomainError.validation("A place cannot be inside one of its own places", { field: "parentId" }));
    }
  }
  const mine = new Set(placeKeys({ name, aliases }));
  const clash = existing.find((p) => !p.archived && p.id !== place.id && (p.parentId ?? "") === (place.parentId ?? "") && placeKeys(p).some((k) => mine.has(k)));
  if (clash) return err(DomainError.validation(`${clash.name} is already listed here`, { field: "name" }));
  return ok({ ...place, name, aliases });
}

/** The tree view of the list: lookups that never mutate it. */
export class PlaceRegistry {
  private readonly byId = new Map<string, PlaceRecord>();
  private readonly children = new Map<string, PlaceRecord[]>();
  private readonly byKey = new Map<string, PlaceRecord[]>();

  constructor(places: readonly PlaceRecord[]) {
    for (const p of places) {
      if (p.archived) continue;
      this.byId.set(p.id, p);
    }
    for (const p of this.byId.values()) {
      if (p.parentId && this.byId.has(p.parentId)) {
        const list = this.children.get(p.parentId);
        if (list) list.push(p);
        else this.children.set(p.parentId, [p]);
      }
      for (const key of placeKeys(p)) {
        const list = this.byKey.get(key);
        if (list) list.push(p);
        else this.byKey.set(key, [p]);
      }
    }
  }

  get size(): number {
    return this.byId.size;
  }
  get(id: string): PlaceRecord | undefined {
    return this.byId.get(id);
  }
  all(): PlaceRecord[] {
    return [...this.byId.values()];
  }
  childrenOf(id: string): PlaceRecord[] {
    return this.children.get(id) ?? [];
  }
  withKey(key: string): PlaceRecord[] {
    return this.byKey.get(key) ?? [];
  }

  /** From the place itself up to its root, nearest first (the place is element 0). */
  chain(id: string): PlaceRecord[] {
    const out: PlaceRecord[] = [];
    for (let at = this.byId.get(id), guard = 0; at && guard < 10; at = at.parentId ? this.byId.get(at.parentId) : undefined, guard += 1) out.push(at);
    return out;
  }
  /** "Rabak › White Nile › Sudan" — a place read in context. */
  pathLabel(id: string): string {
    return this.chain(id).map((p) => p.name).join(" › ");
  }
  /** Every place below this one, any depth. */
  descendantIds(id: string): Set<string> {
    const out = new Set<string>();
    const walk = (at: string, depth: number) => {
      if (depth > 10) return;
      for (const child of this.childrenOf(at)) {
        if (out.has(child.id)) continue;
        out.add(child.id);
        walk(child.id, depth + 1);
      }
    };
    walk(id, 0);
    return out;
  }
  /**
   * The place at `level` that contains `id` (or `id` itself when it is already at or above that
   * level). Undefined when the chain has no place at that level — a roll-up never invents one.
   */
  ancestorAtLevel(id: string, level: AdminLevel): PlaceRecord | undefined {
    for (const p of this.chain(id)) if (p.adminLevel === level) return p;
    const self = this.byId.get(id);
    return self && self.adminLevel < level ? self : undefined;
  }
}

export type PlaceResolution =
  | { status: "RESOLVED"; place: PlaceRecord; via: "NAME" | "ALIAS" | "CONTEXT" }
  | { status: "AMBIGUOUS"; candidates: PlaceRecord[] }
  | { status: "UNRESOLVED" };

export interface ResolveOptions {
  /** The place the work is known to be inside (a project's area): same-named places under it win. */
  withinId?: string;
  /** A country the text is known to be in (ISO code or name, compared folded). */
  country?: string;
}

/**
 * What a typed place means. "Rabak" → the one Rabak; "Rabak, White Nile" → the Rabak whose ancestors
 * include White Nile; two Gulus with nothing to tell them apart → AMBIGUOUS, never a pick.
 */
export function resolvePlace(text: string, registry: PlaceRegistry, options: ResolveOptions = {}): PlaceResolution {
  const raw = text.trim();
  if (!raw) return { status: "UNRESOLVED" };
  const parts = raw.split(/[,;/›>]+/).map((p) => p.trim()).filter(Boolean);
  const key = normalizeLocationKey(parts[0] ?? "");
  if (!key) return { status: "UNRESOLVED" };
  let candidates = registry.withKey(key);
  if (candidates.length === 0) return { status: "UNRESOLVED" };
  let narrowed = false;
  const hintKeys = parts.slice(1).map((p) => normalizeLocationKey(p)).filter(Boolean);
  if (candidates.length > 1 && hintKeys.length) {
    const hinted = candidates.filter((c) => {
      const above = new Set(registry.chain(c.id).slice(1).flatMap((p) => placeKeys(p)));
      return hintKeys.every((h) => above.has(h));
    });
    if (hinted.length) {
      candidates = hinted;
      narrowed = true;
    }
  }
  if (candidates.length > 1 && options.withinId) {
    const inside = registry.descendantIds(options.withinId);
    const within = candidates.filter((c) => inside.has(c.id));
    if (within.length) {
      candidates = within;
      narrowed = true;
    }
  }
  if (candidates.length > 1 && options.country) {
    const want = normalizeLocationKey(options.country);
    const inCountry = candidates.filter((c) => {
      const root = registry.chain(c.id).at(-1);
      return [c.country, root?.country, root?.name].some((v) => v && normalizeLocationKey(v) === want);
    });
    if (inCountry.length) {
      candidates = inCountry;
      narrowed = true;
    }
  }
  if (candidates.length > 1) return { status: "AMBIGUOUS", candidates };
  const place = candidates[0]!;
  const viaName = normalizeLocationKey(place.name) === key;
  return { status: "RESOLVED", place, via: narrowed ? "CONTEXT" : viaName ? "NAME" : "ALIAS" };
}
