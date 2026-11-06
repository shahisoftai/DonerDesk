/**
 * The Studio's view models (Phase 31): pure functions from the enriched project read + a saved
 * config to what the canvas draws. No React, no fetch, no clock. The same section data the export
 * composer draws — the preview cannot disagree with the export because both come from here's
 * server-side twin (the composer) and the same read.
 */

/** Mirrors the API's ProjectInfographicDataDto (kept local so the browser never imports the application package). */
export interface InfographicData {
  projectId: string;
  project: { title: string; projectCode: string; donorName: string; sector: string; country: string; region?: string; district?: string; start: string; end: string; budgetAmount?: number; budgetCurrency?: string; status: string };
  periods: Array<{ id: string; label: string; start: string; end: string; reportType: string; locked: boolean; reportStatus: string }>;
  periodOrder: string[];
  indicators: InfographicIndicatorData[];
  reach: {
    overallUnique: number;
    registeredTotal: number;
    registeredByLocation: Array<{ key: string; location: string; unique: number }>;
    attendancesByActivityLocation: Array<{ key: string; location: string; attendances: number }>;
    beneficiariesWithoutLocation: number;
    attendancesWithoutLocation: number;
    bySex: Record<string, number>;
    byAgeGroup: Record<string, number>;
  };
  activities: { rows: Array<{ key: string; location: string; planned: number; done: number; late: number; cancelled: number }>; unlocated: number };
  finance: { enabled: boolean; rows: Array<{ periodId: string; currency: string; budget: string; expenditure: string; committed?: string; balance: string; burnRatePercent?: string; verified: boolean }> };
  provenance: { generatedAt: string; unverifiedValues: number; locationTrackedIndicators: number; projectWideIndicators: number };
}

export interface InfographicIndicatorData {
  id: string;
  code: string;
  name: string;
  type: string;
  unit?: string;
  baseline: string;
  target: string;
  isRate: boolean;
  lowerIsBetter?: boolean;
  targetBreakdowns: Array<{ dimension: string; category: string; value: string }>;
  location:
    | { kind: "PROJECT_WIDE" }
    | { kind: "ADDITIVE" | "RECORDED"; rows: Array<{ key: string; location: string; value: string; verified: boolean; unverified: number; series: Array<{ reportingPeriodId: string; value: string; verified: boolean }> }> };
  targetActual: { kind: "NO_LOCATION_TARGETS" | "WITH_TARGETS"; rows: Array<{ key: string; location: string; target?: string; actual: string | null; gap?: string; percentOfTarget?: string }> };
  trends: { kind: "NOT_COMPARABLE"; reason: string } | { kind: "OK"; periods: string[]; series: Array<{ key: string; location: string; points: Array<{ reportingPeriodId: string; value: string | null; verified: boolean }> }> };
  projectWideValue: { latestPeriodId?: string; periodValue: string; cumulativeValue: string; verified: boolean } | null;
}

export interface KpiCard {
  value: string;
  label: string;
  detail?: string;
  muted?: boolean;
}

export function kpiCards(data: InfographicData): KpiCard[] {
  const planned = data.activities.rows.reduce((total, row) => total + row.planned, 0) + data.activities.unlocated;
  const done = data.activities.rows.reduce((total, row) => total + row.done, 0);
  const financeRow = data.finance.rows[data.finance.rows.length - 1];
  return [
    {
      value: data.reach.overallUnique === 0 ? "Not yet reported" : data.reach.overallUnique.toLocaleString("en-US"),
      label: "People reached (registered, unique)",
      detail: data.reach.beneficiariesWithoutLocation > 0 ? `${data.reach.beneficiariesWithoutLocation} without a recorded location` : undefined,
      muted: data.reach.overallUnique === 0,
    },
    {
      value: data.activities.rows.length > 0 ? String(data.activities.rows.length) : "Not yet reported",
      label: "Locations with planned activities",
      muted: data.activities.rows.length === 0,
    },
    {
      value: planned > 0 ? `${done} / ${planned}` : "Not yet reported",
      label: "Activities completed of planned",
      detail: data.activities.unlocated > 0 ? `${data.activities.unlocated} without a location` : undefined,
      muted: planned === 0,
    },
    financeRow
      ? { value: financeRow.balance, label: `Balance · expenditure ${financeRow.expenditure} ${financeRow.currency}`, detail: financeRow.verified ? undefined : "Not verified yet", muted: false }
      : { value: "—", label: "Budget", detail: "Finance not recorded", muted: true },
  ];
}

export interface LocationResultRow {
  indicatorCode: string;
  indicatorName: string;
  location: string;
  target?: string;
  actual: string | null;
  percentOfTarget?: string;
  verified: boolean;
}

/** The target-vs-actual rows the LOCATION_RESULTS section shows, location filter applied. */
export function locationResultRows(data: InfographicData, indicatorIds?: string[], locationKeys?: string[]): LocationResultRow[] {
  const rows: LocationResultRow[] = [];
  const wanted = (id: string): boolean => !indicatorIds?.length || indicatorIds.includes(id);
  for (const indicator of data.indicators) {
    if (!wanted(indicator.id)) continue;
    if (indicator.targetActual.kind === "WITH_TARGETS") {
      for (const row of indicator.targetActual.rows) {
        if (locationKeys?.length && !locationKeys.includes(row.key)) continue;
        const locationRow = indicator.location.kind !== "PROJECT_WIDE" ? indicator.location.rows.find((candidate) => candidate.key === row.key) : undefined;
        rows.push({
          indicatorCode: indicator.code,
          indicatorName: indicator.name,
          location: row.location,
          target: row.target,
          actual: row.actual,
          percentOfTarget: row.percentOfTarget,
          verified: locationRow ? locationRow.verified : true,
        });
      }
    } else if (indicator.location.kind !== "PROJECT_WIDE") {
      for (const row of indicator.location.rows) {
        if (locationKeys?.length && !locationKeys.includes(row.key)) continue;
        rows.push({ indicatorCode: indicator.code, indicatorName: indicator.name, location: row.location, actual: row.value, verified: row.verified });
      }
    }
  }
  return rows;
}

export interface ComparisonCell {
  indicatorId: string;
  location: string;
  value: string | null;
  verified: boolean;
}

/** The locations × indicators matrix ( LOCATION_COMPARISON ), gaps absent — "Not reported". */
export function comparisonMatrix(data: InfographicData, locationKeys?: string[]): { locations: string[]; indicators: Array<{ id: string; label: string }>; cells: ComparisonCell[] } {
  const locations = new Map<string, string>();
  const indicators: Array<{ id: string; label: string }> = [];
  const cells: ComparisonCell[] = [];
  for (const indicator of data.indicators) {
    if (indicator.location.kind === "PROJECT_WIDE") continue;
    indicators.push({ id: indicator.id, label: `${indicator.code} ${indicator.name}`.slice(0, 28) });
    for (const row of indicator.location.rows) {
      if (locationKeys?.length && !locationKeys.includes(row.key)) continue;
      locations.set(row.key, row.location);
      cells.push({ indicatorId: indicator.id, location: row.key, value: row.value, verified: row.verified });
    }
  }
  return { locations: [...locations.keys()], indicators, cells };
}

export { AGE_LABEL, SECTION_LABEL, SEX_LABEL } from "./infographics-copy.ts";

/** Plan rows simplified for the map: one dot per located activity group, worst signal wins. */
export interface StudioMapPoint {
  id: string;
  title: string;
  location: string;
  signal: "ON_TIME" | "LATE" | "DONE" | "CANCELLED";
  count: number;
}

export function mapPoints(data: InfographicData): StudioMapPoint[] {
  return data.activities.rows.map((row) => ({
    id: row.key,
    title: row.location,
    location: row.location,
    signal: row.cancelled === row.planned ? "CANCELLED" : row.late > 0 ? "LATE" : row.done >= row.planned ? "DONE" : "ON_TIME",
    count: row.planned,
  }));
}

