/**
 * How each kind of record points at places (Phase 56). One table: which kinds carry places, whether several are allowed, and which record a
 * kind takes its places from when it has none of its own. Nothing branches on a kind's name outside this table. Pure; no node: imports.
 */
import { DomainError } from "../../core/domain-error.js";
import { err, ok, type Result } from "../../core/result.js";
import type { PlaceTree } from "./place-tree.js";
import type { Permission } from "../../policies/permissions.js";

export const RECORD_PLACE_KINDS = ["PLANNED_ACTIVITY", "ACTIVITY", "EVIDENCE", "BENEFICIARY"] as const;
export type RecordPlaceKind = (typeof RECORD_PLACE_KINDS)[number];

/** How a link came to be: inherited from the parent record, chosen by a person, confirmed from typed words, or from the device's own fix. */
export const PLACE_LINK_SOURCES = ["INHERITED", "CHOSEN", "CONFIRMED", "GPS"] as const;
export type PlaceLinkSource = (typeof PLACE_LINK_SOURCES)[number];

export interface PlaceLinkRule {
  /** Several places allowed on one record. */
  many: boolean;
  /** The kind whose places this one copies when it has none (the parent's id is read from the record). */
  inheritsFrom: RecordPlaceKind | null;
  /** At most this many places on one record. */
  max: number;
  /** Plain word for messages. */
  noun: string;
  /** Who may set this kind's places through the shared route; null = set by the kind's own handler (a plan item's lead rules live in `PlanAccess`). */
  permission: Permission | null;
}

export const PLACE_LINK_RULES: Readonly<Record<RecordPlaceKind, PlaceLinkRule>> = {
  PLANNED_ACTIVITY: { many: true, inheritsFrom: null, max: 20, noun: "planned activity", permission: null },
  ACTIVITY: { many: true, inheritsFrom: "PLANNED_ACTIVITY", max: 20, noun: "completed activity", permission: "activity.create" },
  EVIDENCE: { many: true, inheritsFrom: "ACTIVITY", max: 10, noun: "file", permission: "evidence.upload" },
  // A person is registered where they live, not where one activity happened: nothing to inherit.
  BENEFICIARY: { many: false, inheritsFrom: null, max: 1, noun: "person", permission: "activity.create" },
};

export const isRecordPlaceKind = (v: unknown): v is RecordPlaceKind => typeof v === "string" && (RECORD_PLACE_KINDS as readonly string[]).includes(v);

export interface PlaceLinkRecord {
  placeId: string;
  source: PlaceLinkSource;
}

/**
 * The one check for setting a record's places: known kind, within its limit, no repeats, every place live in the tree (merges followed, so a
 * merged id is stored as the place it became). Order is kept: the first place is the main one.
 */
export function checkRecordPlaces(kind: RecordPlaceKind, placeIds: readonly string[], tree: PlaceTree): Result<string[], DomainError> {
  const rule = PLACE_LINK_RULES[kind];
  const out: string[] = [];
  for (const raw of placeIds) {
    const id = tree.current(raw);
    if (!id || !tree.isLive(id)) return err(DomainError.validation("Choose places that are in your list", { field: "placeIds" }));
    if (!out.includes(id)) out.push(id);
  }
  if (!rule.many && out.length > 1) return err(DomainError.validation(`A ${rule.noun} has one place`, { field: "placeIds" }));
  if (out.length > rule.max) return err(DomainError.validation(`A ${rule.noun} has at most ${rule.max} places`, { field: "placeIds" }));
  return ok(out);
}

/**
 * The places a record starts with: its own when it has any; otherwise its parent's, marked INHERITED. Never overwrites a choice and never
 * invents: no parent places, no inheritance. A rule that allows one place takes only the parent's first.
 */
export function inheritPlaces(kind: RecordPlaceKind, own: readonly PlaceLinkRecord[], parent: readonly PlaceLinkRecord[] | null): PlaceLinkRecord[] {
  if (own.length > 0) return [...own];
  const rule = PLACE_LINK_RULES[kind];
  if (!rule.inheritsFrom || !parent || parent.length === 0) return [];
  return parent.slice(0, rule.many ? rule.max : 1).map((p) => ({ placeId: p.placeId, source: "INHERITED" as const }));
}
