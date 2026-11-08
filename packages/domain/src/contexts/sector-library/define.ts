/**
 * A compact way to write library content (Phase 46). Content files list entries with `ind(...)`; this builds the full
 * `LibraryIndicator`, so a data file stays short and every entry still passes `entryProblems`. Entries start UNREVIEWED at
 * version 1; nothing in a data file can mark itself reviewed except through the `review` option, which the content tests check.
 */
import type { DisaggregationDimension } from "../logframe/indicator-disaggregation.js";
import type {
  LibraryAggregation, LibraryDirection, LibraryIndicator, LibraryIndicatorKind, LibraryLevel, LibrarySectorId, LibrarySourceId, ReferenceStandard, ReviewState,
} from "./model.js";

export type Dim = "SEX" | "AGE" | "DIS" | "LOC" | "OTH";
const DIM: Record<Dim, DisaggregationDimension> = { SEX: "SEX", AGE: "AGE_GROUP", DIS: "DISABILITY", LOC: "LOCATION", OTH: "OTHER" };

export interface IndOptions {
  /** The text of the definition. */
  def: string;
  num?: string;
  den?: string;
  kind?: LibraryIndicatorKind;
  unit?: string;
  dir?: "H" | "L" | "N";
  agg?: LibraryAggregation;
  freq?: string;
  level?: LibraryLevel;
  dims?: readonly Dim[];
  cats?: Partial<Record<DisaggregationDimension, readonly string[]>>;
  /** [comparator, value or min, unit, appliesTo, standard text, verified, max?] */
  ref?: readonly [ReferenceStandard["comparator"], number, string, string, string, boolean, number?];
  mov?: readonly string[];
  data?: readonly string[];
  role?: string;
  rec?: boolean;
  tags?: readonly string[];
  also?: readonly LibrarySectorId[];
  src?: LibrarySourceId;
  std?: string;
  review?: ReviewState;
}

const DIRECTIONS: Record<"H" | "L" | "N", LibraryDirection> = { H: "HIGHER", L: "LOWER", N: "NEUTRAL" };
const UNREVIEWED: ReviewState = { status: "UNREVIEWED" };

/** The defaults a sector file sets once: its sector, its source and the group the next entries sit under. */
export interface SectorDefaults { sector: LibrarySectorId; src: LibrarySourceId }

export function sectorWriter(d: SectorDefaults) {
  let group = "";
  return {
    group(name: string): void { group = name; },
    ind(id: string, name: string, o: IndOptions): LibraryIndicator {
      const kind = o.kind ?? "COUNT";
      const source = o.src ?? d.src;
      const sourceRef = { sourceId: source, ...(o.std ? { standard: o.std } : {}) };
      const referenceStandard: ReferenceStandard | undefined = o.ref
        ? {
            comparator: o.ref[0],
            ...(o.ref[0] === "BETWEEN" ? { min: o.ref[1], max: o.ref[6] as number } : { value: o.ref[1] }),
            unit: o.ref[2], appliesTo: o.ref[3],
            sourceRef: { sourceId: source, standard: o.ref[4] },
            verified: o.ref[5],
          }
        : undefined;
      return {
        id, sectorId: d.sector, ...(o.also ? { alsoIn: o.also } : {}), group, name, definition: o.def,
        ...(o.num ? { numerator: o.num } : {}), ...(o.den ? { denominator: o.den } : {}),
        kind, unit: o.unit ?? (kind === "RATE" ? "%" : "people"), direction: DIRECTIONS[o.dir ?? "N"],
        aggregation: o.agg ?? (kind === "COUNT" ? "SUM" : "LATEST"), frequency: o.freq ?? "Quarterly", level: o.level ?? "OUTPUT",
        disaggregations: (o.dims ?? []).map((x) => DIM[x]),
        ...(o.cats ? { categories: o.cats } : {}),
        ...(referenceStandard ? { referenceStandard } : {}),
        meansOfVerification: o.mov ?? ["Programme records"], dataSources: o.data ?? ["Programme monitoring data"],
        sourceRef, ...(o.role ? { roleKey: o.role } : {}), recommended: o.rec ?? false, tags: o.tags ?? [],
        review: o.review ?? UNREVIEWED, version: 1,
      };
    },
  };
}

export const SEX_CATEGORIES = ["Female", "Male"] as const;
export const AGE_CATEGORIES = ["0-4", "5-17", "18-59", "60+"] as const;
