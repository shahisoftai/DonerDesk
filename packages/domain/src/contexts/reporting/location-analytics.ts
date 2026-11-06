/**
 * Location analytics (Phase 31): what a project's results, beneficiaries and activities say per
 * location, computed only from what was actually recorded — never from an allocation. The rules:
 *
 * - A breakdown exists per location only when records carry LOCATION entries; otherwise the view is
 *   project-wide and says so.
 * - Only additive indicator types (NUMBER, CURRENCY) are summed. Rates, percentages and qualitative
 *   indicators are shown as recorded — never summed, never averaged.
 * - A location target exists only where one was planned (`targetBreakdowns`); the project target is
 *   never divided across locations.
 * - A location without a recorded value is absent/"not reported" — never zero.
 * - Registered unique reach and activity attendances are different metrics and are returned apart.
 *
 * Pure: narrow inputs, no clock (period order is given by the caller), no geo assets. Location keys
 * come from `normalizeLocationKey` (the one normalizer); display names stay what was typed.
 */
import type { DisaggregationEntry } from "../logframe/indicator-disaggregation.js";
import type { IndicatorType } from "../logframe/indicator.js";
import type { VerificationStatus } from "../logframe/indicator-update.js";
import { decimalAdd, decimalDivide, decimalIsZero, decimalMultiply, decimalSubtract, formatDecimal, parseDecimal } from "./indicator-calculator.js";
import { locationGroup, normalizeLocationKey, type LocationGroup } from "../workplan/location-key.js";
import type { DeliverySignal } from "../workplan/delivery-state.js";

/** Types whose recorded quantities add up (a percentage split or a status does not). */
const ADDITIVE_TYPES: ReadonlySet<IndicatorType> = new Set<IndicatorType>(["NUMBER", "CURRENCY"]);

export function isAdditiveIndicatorType(type: IndicatorType): boolean {
  return ADDITIVE_TYPES.has(type);
}

/** The indicator fields a location view needs — deliberately narrow (no aggregate, no repository). */
export interface LocationIndicator {
  id: string;
  code: string;
  name: string;
  type: IndicatorType;
}

/** The update fields a location view needs, already in period order (the caller sorts). */
export interface LocationUpdateInput {
  reportingPeriodId: string;
  periodAchievement: string;
  cumulativeAchievement: string;
  verificationStatus: VerificationStatus;
  disaggregation: readonly DisaggregationEntry[];
}

export interface IndicatorLocationRow {
  /** The canonical location key (never displayed). */
  key: string;
  /** The most frequent spelling the officers typed. */
  location: string;
  /** Summed for additive indicators; the latest recorded value otherwise (never summed). */
  value: string;
  /** True when every contributing value is VERIFIED. */
  verified: boolean;
  /** How many contributing values are not verified (the badge count). */
  unverified: number;
  /** Recorded values per period, in the order the caller gave (drives trends). */
  series: Array<{ reportingPeriodId: string; value: string; verified: boolean }>;
}

export type IndicatorLocationView =
  | { kind: "PROJECT_WIDE" }
  | { kind: "ADDITIVE"; rows: IndicatorLocationRow[] }
  | { kind: "RECORDED"; rows: IndicatorLocationRow[] };

const ZERO = "0";
const HUNDRED = parseDecimal("100");

const locationEntriesOf = (update: LocationUpdateInput): DisaggregationEntry[] =>
  update.disaggregation.filter((entry) => entry.dimension === "LOCATION" && entry.category.trim() !== "");

interface ContributionBucket {
  location: string;
  series: Array<{ reportingPeriodId: string; value: string; verified: boolean }>;
  unverified: number;
}

function collectContributions(updates: readonly LocationUpdateInput[]): Map<string, ContributionBucket> | null {
  const votes = new Map<string, Map<string, number>>();
  const byKey = new Map<string, ContributionBucket>();
  let entries = 0;
  for (const update of updates) {
    const verified = update.verificationStatus === "VERIFIED";
    for (const entry of locationEntriesOf(update)) {
      entries += 1;
      const key = normalizeLocationKey(entry.category);
      if (!key) continue;
      const spelling = entry.category.trim();
      let bucket = byKey.get(key);
      if (!bucket) {
        bucket = { location: spelling, series: [], unverified: 0 };
        byKey.set(key, bucket);
        votes.set(key, new Map());
      }
      const ballot = votes.get(key)!;
      ballot.set(spelling, (ballot.get(spelling) ?? 0) + 1);
      bucket.series.push({ reportingPeriodId: update.reportingPeriodId, value: entry.value.trim(), verified });
      if (!verified) bucket.unverified += 1;
    }
  }
  if (entries === 0) return null;
  // Display = the most frequent original spelling (ties: first seen); grouping never rewrites what was typed.
  for (const [key, ballot] of votes) {
    let best = -1;
    for (const [spelling, count] of ballot) {
      if (count > best) {
        best = count;
        byKey.get(key)!.location = spelling;
      }
    }
  }
  return byKey;
}

/**
 * Per-location view of one indicator. `PROJECT_WIDE` when no update carries LOCATION entries — the
 * caller shows the project value and says so instead of a breakdown. Additive types sum their
 * entries; every other type shows the latest recorded value per location and is marked `RECORDED`
 * so no renderer ever totals it.
 */
export function indicatorLocationRows(indicator: LocationIndicator, updates: readonly LocationUpdateInput[]): IndicatorLocationView {
  const byKey = collectContributions(updates);
  if (!byKey) return { kind: "PROJECT_WIDE" };
  const additive = isAdditiveIndicatorType(indicator.type);
  const rows: IndicatorLocationRow[] = [];
  for (const [key, bucket] of byKey) {
    let value = bucket.series[bucket.series.length - 1]?.value ?? ZERO;
    if (additive) {
      let total = parseDecimal(ZERO);
      for (const point of bucket.series) {
        const parsed = parseDecimal(point.value);
        if (parsed && total) total = decimalAdd(total, parsed);
      }
      if (total) value = formatDecimal(total);
    }
    rows.push({ key, location: bucket.location, value, verified: bucket.unverified === 0, unverified: bucket.unverified, series: bucket.series });
  }
  rows.sort((a, b) => Number(b.value.replace(/,/g, "")) - Number(a.value.replace(/,/g, "")) || a.location.localeCompare(b.location));
  return additive ? { kind: "ADDITIVE", rows } : { kind: "RECORDED", rows };
}

/** One location's target beside its recorded actual. A target nobody planned is absent — never derived. */
export interface LocationTargetActualRow {
  key: string;
  location: string;
  /** Present only when a target was recorded for this location. */
  target?: string;
  /** The recorded actual, or `null` when nothing was recorded (shown as "not reported"). */
  actual: string | null;
  /** `target - actual`, only when both exist. */
  gap?: string;
  /** Only for additive types with a positive target and no lower-is-better semantics. */
  percentOfTarget?: string;
}

export type LocationTargetActualView =
  | { kind: "NO_LOCATION_TARGETS"; rows: LocationTargetActualRow[] }
  | { kind: "WITH_TARGETS"; rows: LocationTargetActualRow[] };

/**
 * Targets vs actuals per location. Targets come only from the indicator's recorded LOCATION group
 * targets; actuals only from recorded LOCATION entries. `lowerIsBetter` (the indicator's semantics)
 * suppresses "% of target" — for a ceiling target a worse result would otherwise read as ahead.
 */
export function locationTargetActual(
  indicator: LocationIndicator & { targetBreakdowns?: readonly DisaggregationEntry[]; lowerIsBetter?: boolean },
  updates: readonly LocationUpdateInput[],
): LocationTargetActualView {
  const targets = (indicator.targetBreakdowns ?? []).filter((entry) => entry.dimension === "LOCATION" && entry.category.trim() !== "");
  const additive = isAdditiveIndicatorType(indicator.type);
  const view = indicatorLocationRows(indicator, updates);
  const actuals = new Map<string, IndicatorLocationRow>(view.kind === "PROJECT_WIDE" ? [] : view.rows.map((row) => [row.key, row]));
  const rows: LocationTargetActualRow[] = [];
  const seenKeys = new Set<string>();
  for (const entry of targets) {
    const key = normalizeLocationKey(entry.category);
    if (!key || seenKeys.has(key)) continue;
    seenKeys.add(key);
    const actual = actuals.get(key);
    const row: LocationTargetActualRow = {
      key,
      location: entry.category.trim(),
      target: entry.value.trim(),
      actual: actual ? actual.value : null,
    };
    const targetValue = parseDecimal(entry.value);
    const actualValue = actual ? parseDecimal(actual.value) : null;
    if (targetValue && actualValue) {
      row.gap = formatDecimal(decimalSubtract(targetValue, actualValue));
    }
    if (additive && !indicator.lowerIsBetter && targetValue && !decimalIsZero(targetValue) && actualValue) {
      const share = decimalDivide(actualValue, targetValue);
      if (share && HUNDRED) row.percentOfTarget = formatDecimal(decimalMultiply(share, HUNDRED), 1);
    }
    rows.push(row);
  }
  // Locations with actuals but no planned target: shown (their figure stands alone), no gap, no %.
  for (const [key, actual] of actuals) {
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    rows.push({ key, location: actual.location, actual: actual.value });
  }
  rows.sort((a, b) => (b.target ? 1 : 0) - (a.target ? 1 : 0) || a.location.localeCompare(b.location));
  return targets.length ? { kind: "WITH_TARGETS", rows } : { kind: "NO_LOCATION_TARGETS", rows };
}

/** One matrix cell: the location's figure for one indicator, or nothing (rendered "Not reported"). */
export interface LocationComparisonCell {
  indicatorId: string;
  key: string;
  value: string | null;
  verified: boolean;
  unverified: number;
}

export interface LocationComparisonMatrix {
  locations: LocationGroup[];
  indicators: LocationIndicator[];
  cells: LocationComparisonCell[];
}

/**
 * The locations × indicators matrix. Cells for additive indicators are summed contributions;
 * everything else is the latest recorded value. An indicator with no LOCATION entries contributes
 * no cells at all — its project-wide status is the caller's to show.
 */
export function locationComparison(items: ReadonlyArray<{ indicator: LocationIndicator; updates: readonly LocationUpdateInput[] }>): LocationComparisonMatrix {
  const locations = new Map<string, string>();
  const cells: LocationComparisonCell[] = [];
  const indicators: LocationIndicator[] = [];
  for (const { indicator, updates } of items) {
    const view = indicatorLocationRows(indicator, updates);
    if (view.kind === "PROJECT_WIDE") continue;
    indicators.push(indicator);
    for (const row of view.rows) {
      locations.set(row.key, row.location);
      cells.push({ indicatorId: indicator.id, key: row.key, value: row.value, verified: row.verified, unverified: row.unverified });
    }
  }
  return {
    locations: [...locations.entries()].map(([key, location]) => ({ key, display: location, count: 1 })),
    indicators,
    cells,
  };
}

export type LocationTrendsView =
  | { kind: "NOT_COMPARABLE"; reason: "fewer-than-two-periods" }
  | { kind: "OK"; periods: string[]; series: Array<{ key: string; location: string; points: Array<{ reportingPeriodId: string; value: string | null; verified: boolean }> }> };

/**
 * Per-location series across periods for one indicator. Refused when fewer than two periods carry
 * LOCATION entries — a single point is a bar, not a trend — and for non-additive types, whose
 * values must never be read as a comparable series.
 */
export function locationTrends(indicator: LocationIndicator, updates: readonly LocationUpdateInput[], periodOrder: readonly string[]): LocationTrendsView {
  if (!isAdditiveIndicatorType(indicator.type)) return { kind: "NOT_COMPARABLE", reason: "fewer-than-two-periods" };
  const view = indicatorLocationRows(indicator, updates);
  if (view.kind !== "ADDITIVE") return { kind: "NOT_COMPARABLE", reason: "fewer-than-two-periods" };
  const withEntries = new Set<string>();
  for (const row of view.rows) for (const point of row.series) withEntries.add(point.reportingPeriodId);
  if (withEntries.size < 2) return { kind: "NOT_COMPARABLE", reason: "fewer-than-two-periods" };
  return {
    kind: "OK",
    periods: [...periodOrder],
    series: view.rows.map((row) => ({
      key: row.key,
      location: row.location,
      points: periodOrder.map((periodId) => {
        const point = row.series.find((candidate) => candidate.reportingPeriodId === periodId);
        return point ? { reportingPeriodId: periodId, value: point.value, verified: point.verified } : { reportingPeriodId: periodId, value: null, verified: true };
      }),
    })),
  };
}

/** A registered person, by case code — no name ever reaches these functions. */
export interface ReachBeneficiary {
  id: string;
  location: string;
}

/** One activity attendance (the link table already dedupes per activity). */
export interface ReachLink {
  plannedActivityId: string;
  beneficiaryId: string;
}

export interface ReachActivity {
  plannedActivityId: string;
  location: string;
}

export interface LocationReachRow {
  key: string;
  location: string;
  /** Distinct registered beneficiaries whose own registered location is this one. */
  unique: number;
}

export interface AttendanceLocationRow {
  key: string;
  location: string;
  /** Attendance records at activities held in this location. A person may attend several. */
  attendances: number;
}

export interface UniqueReach {
  /** Distinct registered beneficiaries reached overall — the deduplicated total. */
  overallUnique: number;
  /** Per-location uniques key on the beneficiary's *registered* location; per-location figures may legitimately not add up to the overall total. */
  registeredByLocation: LocationReachRow[];
  /** Attendances key on the *activity's* location — a different metric, labelled apart by the caller. */
  attendancesByActivityLocation: AttendanceLocationRow[];
  /** Reported, never dropped or guessed into a location. */
  beneficiariesWithoutLocation: number;
  attendancesWithoutLocation: number;
}

/**
 * The reach rule, stated once. Registered unique reach = distinct beneficiary ids grouped by the
 * beneficiary's own registered location. Attendances = link rows grouped by the activity's
 * location. The two never mix, and neither is shown as "people reached" without its label.
 */
export function uniqueReach(input: {
  beneficiaries: readonly ReachBeneficiary[];
  links: readonly ReachLink[];
  activities: readonly ReachActivity[];
}): UniqueReach {
  const reachedIds = new Set(input.links.map((link) => link.beneficiaryId));
  const reached = input.beneficiaries.filter((beneficiary) => reachedIds.has(beneficiary.id));

  const registeredByLocation: LocationReachRow[] = locationGroup(reached).map(({ group, members }) => ({
    key: group.key,
    location: group.display,
    unique: new Set(members.map((member) => member.id)).size,
  }));
  registeredByLocation.sort((a, b) => b.unique - a.unique || a.location.localeCompare(b.location));

  const locationByActivity = new Map<string, string>();
  for (const activity of input.activities) {
    const trimmed = activity.location?.trim() ?? "";
    if (trimmed) locationByActivity.set(activity.plannedActivityId, trimmed);
  }
  const attendanceRecords: Array<{ plannedActivityId: string; beneficiaryId: string; location: string }> = [];
  let attendancesWithoutLocation = 0;
  for (const link of input.links) {
    const location = locationByActivity.get(link.plannedActivityId);
    if (!location) {
      attendancesWithoutLocation += 1;
      continue;
    }
    attendanceRecords.push({ plannedActivityId: link.plannedActivityId, beneficiaryId: link.beneficiaryId, location });
  }
  const attendancesByActivityLocation: AttendanceLocationRow[] = locationGroup(attendanceRecords).map(({ group, members }) => ({
    key: group.key,
    location: group.display,
    attendances: members.length,
  }));
  attendancesByActivityLocation.sort((a, b) => b.attendances - a.attendances || a.location.localeCompare(b.location));

  return {
    overallUnique: reachedIds.size,
    registeredByLocation,
    attendancesByActivityLocation,
    beneficiariesWithoutLocation: reached.filter((beneficiary) => !beneficiary.location?.trim()).length,
    attendancesWithoutLocation,
  };
}

/** One plan row's location and the signal the plan list already derives — no new status math. */
export interface PlanRowLocationInput {
  location?: string | undefined;
  signal: DeliverySignal;
}

export interface ActivitiesByLocationRow {
  key: string;
  location: string;
  planned: number;
  done: number;
  late: number;
  cancelled: number;
}

export interface ActivitiesByLocation {
  rows: ActivitiesByLocationRow[];
  /** Activities with no location at all — reported explicitly, never folded into a place. */
  unlocated: number;
}

/** Planned / done / late / cancelled counts per location from the existing delivery signals. */
export function activitiesByLocation(rows: readonly PlanRowLocationInput[]): ActivitiesByLocation {
  const spellings = new Map<string, Map<string, number>>();
  const buckets = new Map<string, ActivitiesByLocationRow>();
  let unlocated = 0;
  for (const row of rows) {
    const trimmed = row.location?.trim() ?? "";
    const key = trimmed ? normalizeLocationKey(trimmed) : "";
    if (!key) {
      unlocated += 1;
      continue;
    }
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { key, location: trimmed, planned: 0, done: 0, late: 0, cancelled: 0 };
      buckets.set(key, bucket);
      spellings.set(key, new Map());
    }
    const ballot = spellings.get(key)!;
    ballot.set(trimmed, (ballot.get(trimmed) ?? 0) + 1);
    bucket.planned += 1;
    if (row.signal === "DONE") bucket.done += 1;
    if (row.signal === "LATE") bucket.late += 1;
    if (row.signal === "CANCELLED") bucket.cancelled += 1;
  }
  for (const [key, ballot] of spellings) {
    let best = -1;
    for (const [spelling, count] of ballot) {
      if (count > best) {
        best = count;
        buckets.get(key)!.location = spelling;
      }
    }
  }
  const out = [...buckets.values()].sort((a, b) => b.planned - a.planned || a.location.localeCompare(b.location));
  return { rows: out, unlocated };
}
