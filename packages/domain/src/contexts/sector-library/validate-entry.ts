/**
 * The one check of a library indicator (Phase 46): everything wrong with an entry, as plain sentences with a code. It is run by
 * the content tests over every entry, by the organisation's own additions, and by the reviewer-sheet import. Pure.
 */
import { DISAGGREGATION_DIMENSIONS } from "../logframe/indicator-disaggregation.js";
import { KIND_RULES } from "./kinds.js";
import type { LibraryIndicator } from "./model.js";
import { LIBRARY_SECTOR_IDS, LIBRARY_SOURCE_IDS } from "./model.js";

export interface EntryProblem { code: string; message: string }

const ID = /^[A-Z][A-Z0-9_]*(-[A-Z0-9]+)+$/;
const LEVELS = ["GOAL", "OUTCOME", "OUTPUT", "ACTIVITY"];
const DIRECTIONS = ["HIGHER", "LOWER", "NEUTRAL"];
const STATUSES = ["UNREVIEWED", "IN_REVIEW", "REVIEWED", "DEPRECATED"];

export function entryProblems(e: LibraryIndicator): EntryProblem[] {
  const out: EntryProblem[] = [];
  const add = (code: string, message: string) => out.push({ code, message });
  if (!ID.test(e.id)) add("ID_FORMAT", "An id is capital letters, digits and dashes, such as WASH-W-01.");
  if (!(LIBRARY_SECTOR_IDS as readonly string[]).includes(e.sectorId)) add("SECTOR", "The sector is not one the library knows.");
  for (const other of e.alsoIn ?? []) if (!(LIBRARY_SECTOR_IDS as readonly string[]).includes(other) || other === e.sectorId) add("ALSO_IN", "A sector listed as also using this indicator is unknown or is its own sector.");
  if (!e.name.trim() || e.name.length > 300) add("NAME", "An indicator needs a name of at most 300 characters.");
  if (e.definition.trim().length < 12 || e.definition.length > 800) add("DEFINITION", "An indicator needs a definition of 12 to 800 characters.");
  if (!e.group.trim()) add("GROUP", "An indicator belongs to a group the picker shows it under.");
  if (!e.unit.trim()) add("UNIT", "An indicator needs a unit.");
  if (!LEVELS.includes(e.level)) add("LEVEL", "The result level is not known.");
  if (!DIRECTIONS.includes(e.direction)) add("DIRECTION", "Say which way is better (or neutral).");
  if (!e.frequency.trim()) add("FREQUENCY", "An indicator needs a collection frequency.");
  const kind = KIND_RULES[e.kind];
  if (!kind) add("KIND", "The kind of indicator is not known.");
  else {
    if (!kind.aggregations.includes(e.aggregation)) add("AGGREGATION", `A ${e.kind.toLowerCase()} indicator cannot be combined across periods by ${e.aggregation.toLowerCase()}.`);
    for (const m of kind.check(e)) add("KIND_RULE", m);
    if (e.kind === "RATE" && (e.numerator === undefined) !== (e.denominator === undefined)) add("RATE_PARTS", "Give a rate both its numerator and its denominator, or neither.");
  }
  for (const d of e.disaggregations) if (!DISAGGREGATION_DIMENSIONS.includes(d)) add("DISAGGREGATION", `The breakdown ${d} is not known.`);
  for (const d of Object.keys(e.categories ?? {})) if (!e.disaggregations.includes(d as never)) add("CATEGORIES", `Categories are given for ${d}, which the indicator does not break down by.`);
  if (e.meansOfVerification.length === 0) add("VERIFICATION", "Say how the figure is verified.");
  if (!(LIBRARY_SOURCE_IDS as readonly string[]).includes(e.sourceRef.sourceId)) add("SOURCE", "The source is not one the library knows.");
  const r = e.referenceStandard;
  if (r) {
    if (!(LIBRARY_SOURCE_IDS as readonly string[]).includes(r.sourceRef.sourceId)) add("REFERENCE_SOURCE", "The reference standard names an unknown source.");
    if (r.comparator === "BETWEEN") { if (!(Number.isFinite(r.min) && Number.isFinite(r.max)) || (r.min as number) >= (r.max as number)) add("REFERENCE_RANGE", "A range needs a lower and a higher figure."); }
    else if (!Number.isFinite(r.value)) add("REFERENCE_VALUE", "A reference standard needs its figure.");
    if (!r.unit.trim() || !r.appliesTo.trim()) add("REFERENCE_UNIT", "A reference standard names its unit and whom it applies to.");
    if (e.direction === "HIGHER" && r.comparator === "LTE") add("REFERENCE_DIRECTION", "A standard that is a maximum does not fit an indicator where higher is better.");
    if (e.direction === "LOWER" && r.comparator === "GTE") add("REFERENCE_DIRECTION", "A standard that is a minimum does not fit an indicator where lower is better.");
  }
  if (!STATUSES.includes(e.review.status)) add("REVIEW", "The review state is not known.");
  if (e.review.status === "REVIEWED" && (!e.review.reviewer || !e.review.reviewedOn)) add("REVIEW_WHO", "A reviewed entry names who reviewed it and when.");
  if (!Number.isInteger(e.version) || e.version < 1) add("VERSION", "The version is a whole number from 1.");
  if (e.review.status === "DEPRECATED" && !e.deprecatedBy) add("DEPRECATED_BY", "A deprecated entry names the one that replaces it.");
  return out;
}
