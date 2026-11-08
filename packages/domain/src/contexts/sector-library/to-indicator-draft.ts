/**
 * A library entry as the fields a project indicator has (Phase 46). The entry is copied, never referenced: a project keeps its
 * own indicator, plus a small link (`LibraryLink`) that remembers which entry and which version it came from and what that
 * entry said then, so a later change can be shown as a difference and applied or ignored field by field. Pure.
 */
import type { IndicatorType } from "../logframe/indicator.js";
import type { IndicatorSemantics } from "../logframe/indicator-semantics.js";
import type { DisaggregationDimension } from "../logframe/indicator-disaggregation.js";
import { KIND_RULES } from "./kinds.js";
import type { LibraryDirection, LibraryIndicator, ReferenceStandard } from "./model.js";

export interface IndicatorFields {
  code: string;
  name: string;
  type: IndicatorType;
  unit: string;
  frequency: string;
  meansOfVerification: string;
  dataSource: string;
  definition: string;
  disaggregation: readonly DisaggregationDimension[];
  semantics: IndicatorSemantics;
}

/** What the entry said when the project adopted it; compared with the entry later (`diffVersions`). */
export interface LibrarySnapshot {
  name: string;
  definition: string;
  kind: LibraryIndicator["kind"];
  unit: string;
  direction: LibraryDirection;
  aggregation: LibraryIndicator["aggregation"];
  frequency: string;
  disaggregations: readonly DisaggregationDimension[];
  meansOfVerification: readonly string[];
  referenceStandard: ReferenceStandard | null;
}

export interface LibraryLink {
  id: string;
  version: number;
  adoptedOn: string;
  snapshot: LibrarySnapshot;
}

const DIRECTION = { HIGHER: "HIGHER_IS_BETTER", LOWER: "LOWER_IS_BETTER", NEUTRAL: "NEUTRAL" } as const;

/**
 * How the adopted indicator is read. A reviewed entry is trusted as inferred; an unreviewed one asks a person to confirm (the
 * existing "how this indicator is read" step), so a library direction is never a silent authority.
 */
export function semanticsOf(e: LibraryIndicator): IndicatorSemantics {
  return {
    aggregation: e.aggregation,
    direction: DIRECTION[e.direction],
    reportingBasis: e.aggregation === "SUM" ? "CUMULATIVE" : "PERIOD",
    status: e.review.status === "REVIEWED" ? "INFERRED" : "REQUIRES_REVIEW",
  };
}

export function indicatorFieldsOf(e: LibraryIndicator, code: string = e.id): IndicatorFields {
  return {
    code,
    name: e.name,
    type: KIND_RULES[e.kind].indicatorType,
    unit: e.unit,
    frequency: e.frequency,
    meansOfVerification: e.meansOfVerification.join("; "),
    dataSource: e.dataSources.join("; "),
    definition: e.definition,
    disaggregation: e.disaggregations,
    semantics: semanticsOf(e),
  };
}

export function snapshotOf(e: LibraryIndicator): LibrarySnapshot {
  return {
    name: e.name, definition: e.definition, kind: e.kind, unit: e.unit, direction: e.direction, aggregation: e.aggregation,
    frequency: e.frequency, disaggregations: e.disaggregations, meansOfVerification: e.meansOfVerification, referenceStandard: e.referenceStandard ?? null,
  };
}

export function linkOf(e: LibraryIndicator, adoptedOn: string): LibraryLink {
  return { id: e.id, version: e.version, adoptedOn, snapshot: snapshotOf(e) };
}

/** A project code for an entry: its own id, or the id with a number when the project already uses it. */
export function projectCodeFor(e: LibraryIndicator, taken: ReadonlySet<string>): string {
  if (!taken.has(e.id)) return e.id;
  for (let n = 2; n < 100; n += 1) if (!taken.has(`${e.id}-${n}`)) return `${e.id}-${n}`;
  return `${e.id}-${taken.size + 1}`;
}

/** The wizard's words for a direction (the proposal keeps it as text until a person confirms). */
export const DIRECTION_WORDS: Readonly<Record<LibraryDirection, string | null>> = { HIGHER: "higher is better", LOWER: "lower is better", NEUTRAL: null };

/** Reads a stored link back; a malformed or unknown value is `null`, never a guess. */
export function parseLink(json: string | null | undefined): LibraryLink | null {
  if (!json) return null;
  try {
    const v = JSON.parse(json) as Partial<LibraryLink>;
    if (!v || typeof v.id !== "string" || typeof v.version !== "number" || !v.snapshot || typeof v.snapshot.name !== "string") return null;
    return v as LibraryLink;
  } catch {
    return null;
  }
}

/** How an adopted indicator is read, from what the entry said when it was adopted. Never configured: a person still confirms it. */
export function semanticsFromSnapshot(snapshot: LibrarySnapshot): IndicatorSemantics {
  return { aggregation: snapshot.aggregation, direction: DIRECTION[snapshot.direction], reportingBasis: snapshot.aggregation === "SUM" ? "CUMULATIVE" : "PERIOD", status: "REQUIRES_REVIEW" };
}
