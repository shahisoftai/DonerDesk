/**
 * An organisation's own use of the library (Phase 46.7), as pure rules over the stored records: entries it added, entries it hid,
 * entries it reworded, and its review decisions. The built-in library is never changed; the organisation sees the built-in
 * entries with its own changes laid over them. A stored record that no longer passes the checks is skipped and reported,
 * never allowed to hide the library or to block a project.
 */
import { entryProblems } from "./validate-entry.js";
import type { LibraryIndicator, LibraryLevel, ReferenceStandard } from "./model.js";
import type { LibraryReviewDecision } from "./review.js";

export type OrgEntryKind = "ADDED" | "OVERRIDE" | "HIDDEN" | "REVIEW";
export interface OrgEntryRecord { entryId: string; kind: OrgEntryKind; payload: unknown; libraryVersion: number | null }

/** The fields an organisation may reword on a built-in entry. The kind, the unit family and the source stay the library's. */
export const OVERRIDE_FIELDS = ["name", "definition", "unit", "frequency", "direction", "meansOfVerification", "dataSources", "referenceStandard", "level"] as const;
export type OverrideField = (typeof OVERRIDE_FIELDS)[number];
export type EntryOverride = Partial<Pick<LibraryIndicator, "name" | "definition" | "unit" | "frequency" | "direction" | "meansOfVerification" | "dataSources" | "level">> & { referenceStandard?: ReferenceStandard | null };

export interface EffectiveLibrary {
  entries: LibraryIndicator[];
  /** Ids of built-in entries the organisation hid. */
  hidden: ReadonlySet<string>;
  /** Ids the organisation reworded. */
  overridden: ReadonlySet<string>;
  /** Ids the organisation added itself. */
  added: ReadonlySet<string>;
  decisions: ReadonlyMap<string, LibraryReviewDecision>;
  skipped: Array<{ entryId: string; kind: OrgEntryKind; reason: string }>;
}

/** An organisation's own entries are named ORG-... so they can never collide with a built-in id. */
export const ORG_ENTRY_PREFIX = "ORG-";

export function checkOverride(base: LibraryIndicator, patch: unknown): { ok: true; entry: LibraryIndicator; override: EntryOverride } | { ok: false; reason: string } {
  if (!patch || typeof patch !== "object") return { ok: false, reason: "Describe what to change." };
  const raw = patch as Record<string, unknown>;
  const unknown = Object.keys(raw).filter((k) => !(OVERRIDE_FIELDS as readonly string[]).includes(k));
  if (unknown.length > 0) return { ok: false, reason: `These fields are the library's and cannot be changed: ${unknown.join(", ")}.` };
  const override: EntryOverride = {};
  for (const k of OVERRIDE_FIELDS) if (k in raw) (override as Record<string, unknown>)[k] = raw[k];
  if (Object.keys(override).length === 0) return { ok: false, reason: "Nothing to change." };
  const { referenceStandard, ...rest } = override;
  const merged = { ...base, ...rest, ...(referenceStandard === undefined ? {} : referenceStandard === null ? { referenceStandard: undefined } : { referenceStandard }) } as LibraryIndicator;
  if (referenceStandard === null) delete (merged as { referenceStandard?: unknown }).referenceStandard;
  const problems = entryProblems(merged);
  return problems.length > 0 ? { ok: false, reason: problems[0]!.message } : { ok: true, entry: merged, override };
}

export function checkAddedEntry(raw: unknown): { ok: true; entry: LibraryIndicator } | { ok: false; reason: string } {
  if (!raw || typeof raw !== "object") return { ok: false, reason: "Describe the indicator." };
  const entry = raw as LibraryIndicator;
  if (typeof entry.id !== "string" || !entry.id.startsWith(ORG_ENTRY_PREFIX)) return { ok: false, reason: `An entry of your own has an id that starts with ${ORG_ENTRY_PREFIX}.` };
  const problems = entryProblems(entry);
  return problems.length > 0 ? { ok: false, reason: problems[0]!.message } : { ok: true, entry };
}

const LEVELS: readonly LibraryLevel[] = ["GOAL", "OUTCOME", "OUTPUT", "ACTIVITY"];
export const isLevel = (v: unknown): v is LibraryLevel => typeof v === "string" && (LEVELS as readonly string[]).includes(v);

/** The library as an organisation sees it. Order: built-in entries (reworded or hidden as chosen), then its own additions. */
export function applyOrganisationEntries(builtIn: readonly LibraryIndicator[], records: readonly OrgEntryRecord[]): EffectiveLibrary {
  const hidden = new Set<string>();
  const overridden = new Set<string>();
  const added = new Set<string>();
  const decisions = new Map<string, LibraryReviewDecision>();
  const skipped: EffectiveLibrary["skipped"] = [];
  const byId = new Map(builtIn.map((e) => [e.id, e] as const));
  const entries = new Map(builtIn.map((e) => [e.id, e] as const));
  const skip = (r: OrgEntryRecord, reason: string) => skipped.push({ entryId: r.entryId, kind: r.kind, reason });

  for (const r of records) {
    if (r.kind === "HIDDEN") { if (byId.has(r.entryId)) hidden.add(r.entryId); else skip(r, "The entry is not in the library."); continue; }
    if (r.kind === "OVERRIDE") {
      const base = byId.get(r.entryId);
      if (!base) { skip(r, "The entry is not in the library."); continue; }
      if (r.libraryVersion !== null && r.libraryVersion !== base.version) { skip(r, "The library entry changed since it was reworded; reword it again."); continue; }
      const checked = checkOverride(base, r.payload);
      if (!checked.ok) { skip(r, checked.reason); continue; }
      entries.set(r.entryId, checked.entry);
      overridden.add(r.entryId);
      continue;
    }
    if (r.kind === "ADDED") {
      const checked = checkAddedEntry(r.payload);
      if (!checked.ok) { skip(r, checked.reason); continue; }
      if (byId.has(checked.entry.id)) { skip(r, "That id belongs to the library."); continue; }
      entries.set(checked.entry.id, checked.entry);
      added.add(checked.entry.id);
      continue;
    }
    if (r.kind === "REVIEW") {
      const d = r.payload as Partial<LibraryReviewDecision> | null;
      if (!d || typeof d.status !== "string" || typeof d.reviewer !== "string" || typeof d.reviewedOn !== "string" || typeof d.version !== "number") { skip(r, "The review decision is incomplete."); continue; }
      decisions.set(r.entryId, { entryId: r.entryId, version: d.version, status: d.status, reviewer: d.reviewer, reviewedOn: d.reviewedOn, ...(d.note ? { note: d.note } : {}) });
    }
  }
  return { entries: [...entries.values()].filter((e) => !hidden.has(e.id)), hidden, overridden, added, decisions, skipped };
}
