/** Reach, activities and the two by-place tables (Phase 45.1). A place nobody planned is `null` ("Not planned"), a place nobody reported is `null` ("Not reported"); per-place uniques may not add up to the overall total, and the model says so. */
import type { CanvasFacts } from "../facts.js";
import { empty, ready, unavailable, NO_FACTS, type SectionProps } from "./props.js";

export const reachModel = (_props: SectionProps, facts: CanvasFacts | undefined) => {
  if (!facts) return unavailable(NO_FACTS);
  const reach = facts.reach;
  if (reach.overallUnique === 0) return empty("No beneficiaries are registered yet.");
  const rows = reach.registeredByLocation.slice(0, 5).map((x) => ({ location: x.location, unique: x.unique }));
  return ready({
    overallUnique: reach.overallUnique, registeredTotal: reach.registeredTotal, rows,
    attendances: reach.attendancesByActivityLocation.reduce((n, x) => n + x.attendances, 0),
    withoutLocation: reach.beneficiariesWithoutLocation,
  }, reach.registeredByLocation.length > rows.length ? [`Showing the first ${rows.length} of ${reach.registeredByLocation.length} places.`] : []);
};

export const activitiesByLocationModel = (_props: SectionProps, facts: CanvasFacts | undefined) => {
  if (!facts) return unavailable(NO_FACTS);
  const a = facts.activities;
  if (a.rows.length === 0 && a.unlocated === 0) return empty("No activities are planned yet.");
  const rows = a.rows.slice(0, 6).map((x) => ({ location: x.location, planned: x.planned, done: x.done, late: x.late }));
  return ready({ rows, unlocated: a.unlocated }, a.rows.length > rows.length ? [`Showing the first ${rows.length} of ${a.rows.length} places.`] : []);
};

const ROW_CAP = 18;

export const locationResultsModel = (props: SectionProps, facts: CanvasFacts | undefined) => {
  if (!facts) return unavailable(NO_FACTS);
  const named = props.indicatorIds;
  const pick = (i: { id: string }) => !named?.length || named.includes(i.id);
  const withTargets = facts.indicators.filter((i) => i.targetActual.kind === "WITH_TARGETS" && pick(i));
  const tracked = withTargets.length > 0 ? withTargets : facts.indicators.filter((i) => i.location.kind !== "PROJECT_WIDE" && pick(i));
  if (tracked.length === 0) return empty("No indicator is recorded by place yet.");
  const keys = props.locationKeys?.length ? props.locationKeys : facts.locationKeys;
  const seen = new Set<string>();
  const rows: Array<{ indicator: string; location: string; target: string | null; actual: string | null; percentOfTarget: string | null; verified: boolean | null }> = [];
  for (const indicator of tracked) {
    const source = indicator.targetActual.kind === "WITH_TARGETS"
      ? indicator.targetActual.rows.map((x) => ({ key: x.key, location: x.location, target: x.target ?? null, actual: x.actual, pct: x.percentOfTarget ?? null, verified: null as boolean | null }))
      : indicator.location.kind !== "PROJECT_WIDE" ? indicator.location.rows.map((x) => ({ key: x.key, location: x.location, target: null, actual: x.value, pct: null, verified: x.verified })) : [];
    for (const x of source) {
      const id = `${indicator.id}|${x.key}`;
      if (seen.has(id) || (keys?.length && !keys.includes(x.key))) continue;
      seen.add(id);
      rows.push({ indicator: indicator.code, location: x.location, target: x.target, actual: x.actual, percentOfTarget: x.pct, verified: x.verified });
    }
  }
  if (rows.length === 0) return empty("Nothing is recorded for the chosen places.");
  const shown = rows.slice(0, ROW_CAP);
  const notes = [...(rows.length > shown.length ? [`Showing the first ${ROW_CAP} of ${rows.length} rows.`] : []), ...(shown.some((r) => r.verified === false) ? ["Some figures are not verified yet."] : [])];
  return ready({ rows: shown }, notes);
};

export const locationComparisonModel = (_props: SectionProps, facts: CanvasFacts | undefined) => {
  if (!facts) return unavailable(NO_FACTS);
  const tracked = facts.indicators.filter((i) => i.location.kind !== "PROJECT_WIDE").slice(0, 5);
  if (tracked.length === 0) return empty("No indicator is recorded by place yet.");
  const locations = new Map<string, string>();
  for (const i of tracked) if (i.location.kind !== "PROJECT_WIDE") for (const x of i.location.rows) locations.set(x.key, x.location);
  const rows = [...locations].map(([key, location]) => ({
    location,
    cells: tracked.map((i) => { const cell = i.location.kind === "PROJECT_WIDE" ? undefined : i.location.rows.find((x) => x.key === key); return cell ? { value: cell.value, verified: cell.verified } : null; }),
  }));
  return ready({ columns: tracked.map((i) => ({ code: i.code, name: i.name })), rows }, rows.some((r) => r.cells.some((c) => c && !c.verified)) ? ["Some figures are not verified yet."] : []);
};
