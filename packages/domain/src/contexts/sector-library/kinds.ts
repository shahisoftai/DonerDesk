/**
 * What each kind of library indicator means for the rest of the product (Phase 46). One row per kind: the indicator type it is
 * stored as, the ways its values may be combined, and the rules that follow from that. A new kind is a row; no caller branches
 * on a kind. The honesty rules of the product live here once: a rate or a per-person average is never summed, a score is never
 * read as a percentage of target, a yes/no has nothing to add.
 */
import type { IndicatorType } from "../logframe/indicator.js";
import type { LibraryAggregation, LibraryIndicator, LibraryIndicatorKind } from "./model.js";

export interface KindRule {
  /** The type the adopted indicator is stored as. Averages and scores are RATIO so no total is ever built from them. */
  indicatorType: IndicatorType;
  /** How values of different periods may be combined. A kind that is not additive never allows SUM. */
  aggregations: readonly LibraryAggregation[];
  /** May values of several places or groups be added together. */
  additive: boolean;
  /** Does "percent of target" mean anything for it. */
  sharesOfTarget: boolean;
  /** Kind-specific problems with an entry, as plain sentences. */
  check(entry: LibraryIndicator): string[];
}

const none = (): string[] => [];

export const KIND_RULES: Readonly<Record<LibraryIndicatorKind, KindRule>> = {
  COUNT: {
    indicatorType: "NUMBER",
    aggregations: ["SUM", "LATEST"],
    additive: true,
    sharesOfTarget: true,
    check: (e) => (e.referenceStandard && e.referenceStandard.unit.includes("%") ? ["A count cannot be compared with a percentage standard."] : []),
  },
  RATE: {
    indicatorType: "PERCENTAGE",
    aggregations: ["LATEST", "AVERAGE"],
    additive: false,
    sharesOfTarget: false,
    check: (e) => (e.unit.trim() !== "%" ? ['A rate is written in "%".'] : []),
  },
  RATIO: {
    indicatorType: "RATIO",
    aggregations: ["LATEST", "AVERAGE"],
    additive: false,
    sharesOfTarget: false,
    check: (e) => (e.unit.includes("%") ? ['A ratio is not written in "%": use the rate kind.'] : []),
  },
  INDEX: {
    indicatorType: "RATIO",
    aggregations: ["LATEST", "AVERAGE"],
    additive: false,
    sharesOfTarget: false,
    check: (e) => (e.numerator || e.denominator ? ["An index is a score, not a numerator over a denominator."] : []),
  },
  BINARY: {
    indicatorType: "YES_NO",
    aggregations: ["LATEST"],
    additive: false,
    sharesOfTarget: false,
    check: (e) => (e.referenceStandard ? ["A yes/no answer has no numeric standard."] : []),
  },
  QUALITATIVE: {
    indicatorType: "TEXT",
    aggregations: ["LATEST"],
    additive: false,
    sharesOfTarget: false,
    check: none,
  },
};

export const KIND_ORDER: readonly LibraryIndicatorKind[] = ["COUNT", "RATE", "RATIO", "INDEX", "BINARY", "QUALITATIVE"];
