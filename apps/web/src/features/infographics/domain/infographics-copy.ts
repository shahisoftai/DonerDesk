/**
 * Phase 31 — every Studio string a person reads that is keyed by a code lives here, scanned by
 * the copy lint (`findRawTokens`): no raw kind, sex, age or snake_case key may leak into a label.
 * The section labels are the domain's own table (one source); the rest are the Studio's.
 */
import { DEFAULT_SECTION_LABEL } from "@donordesk/domain/contexts/infographics/index.js";

/** The heading a section shows when the officer did not author one. */
export const SECTION_LABEL: Readonly<Record<string, string>> = DEFAULT_SECTION_LABEL;

export const SEX_LABEL: Record<string, string> = { FEMALE: "Women / girls", MALE: "Men / boys", OTHER: "Other" };

export const AGE_LABEL: Record<string, string> = { UNDER_5: "Under 5", AGE_5_17: "5–17", AGE_18_59: "18–59", AGE_60_PLUS: "60+" };

/** The repeated Studio sentences, worded once. */
export const STUDIO_HINT = {
  emptyData: "Not yet reported",
  chartEmpty: "Not yet reported — this chart needs recorded values.",
  resultsEmpty: "Not yet reported — no location-tracked results recorded.",
  comparisonEmpty: "Not yet reported — no location-tracked indicators.",
  reachEmpty: "Not yet reported — no attendance recorded yet.",
  activitiesEmpty: "Not yet reported — no planned activities yet.",
  mapEmpty: "Not yet reported — no placed sites yet.",
  mapUnplaced: "Sites could not be placed on the map yet — they are listed, never guessed.",
  notPlanned: "Not planned",
  notReported: "Not reported",
  unverified: "unverified",
} as const;
