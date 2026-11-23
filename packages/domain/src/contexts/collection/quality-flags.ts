import { distanceKm } from "../places/analysis/distance.js";

/**
 * Signs that an assessment may not be what it seems (Phase 62.5, anticipated gap A9). They are shown to the reviewer and never block:
 * a fast visit to a small unit and a phone with a weak GPS fix are both real. One row per rule; a rule that lacks its facts says nothing.
 */
export type QualityFlagCode = "TOO_FAST" | "FAR_FROM_FACILITY" | "DUPLICATE_VISIT" | "FEW_ANSWERS";

export interface QualityInput {
  /** When the person began (the draft's first save), when they sent it. */
  startedAt?: Date | undefined;
  submittedAt: Date;
  /** How many answers were given, and how many questions were asked. */
  answered: number;
  asked: number;
  /** Where the phone said it was, and where the facility is pinned. */
  gps?: { lat: number; lon: number } | undefined;
  facilityPin?: { lat: number; lon: number } | undefined;
  /** Another record for the same facility already waits or was accepted in the same reporting period. */
  sameFacilityInPeriod: boolean;
}
export interface QualityFlag { code: QualityFlagCode; detail: string }

interface Rule { code: QualityFlagCode; check(input: QualityInput): string | null }

/** Seconds a person needs per answer, at the very least. */
export const MIN_SECONDS_PER_ANSWER = 3;
/** How far from the facility's pin a fix may be before it is mentioned. */
export const FAR_KM = 2;
/** The share of questions answered below which a record is "mostly empty". */
export const FEW_ANSWERS_SHARE = 0.3;

const RULES: readonly Rule[] = [
  { code: "TOO_FAST", check: (i) => {
    if (!i.startedAt) return null;
    const seconds = (i.submittedAt.getTime() - i.startedAt.getTime()) / 1000;
    return seconds < i.answered * MIN_SECONDS_PER_ANSWER ? `${Math.max(0, Math.round(seconds / 60))} minutes for ${i.answered} answers` : null;
  } },
  { code: "FAR_FROM_FACILITY", check: (i) => {
    if (!i.gps || !i.facilityPin) return null;
    const km = distanceKm({ lng: i.gps.lon, lat: i.gps.lat }, { lng: i.facilityPin.lon, lat: i.facilityPin.lat });
    return km > FAR_KM ? `${km.toFixed(1)} km from the facility's pin` : null;
  } },
  { code: "DUPLICATE_VISIT", check: (i) => (i.sameFacilityInPeriod ? "another record for this facility is already in this period" : null) },
  { code: "FEW_ANSWERS", check: (i) => (i.asked > 0 && i.answered / i.asked < FEW_ANSWERS_SHARE ? `${i.answered} of ${i.asked} questions answered` : null) },
];

export const qualityFlags = (input: QualityInput): QualityFlag[] =>
  RULES.flatMap((r) => { const detail = r.check(input); return detail ? [{ code: r.code, detail }] : []; });
