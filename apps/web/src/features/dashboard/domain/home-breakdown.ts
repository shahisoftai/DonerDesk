/**
 * Breakdowns of the projects on Home (Phase 35.H1): how many projects by sector, status, country or funder, and the filter a click applies to the project table.
 * Pure. A project with no value for the chosen key is grouped as "Not recorded" (never dropped); the groups count projects, they do not rate them.
 */
export const BREAKDOWN_KEYS = ["SECTOR", "STATUS", "COUNTRY", "FUNDER"] as const;
export type BreakdownBy = (typeof BREAKDOWN_KEYS)[number];

export const BREAKDOWN_LABEL: Record<BreakdownBy, string> = { SECTOR: "Sector", STATUS: "Status", COUNTRY: "Country", FUNDER: "Funder" };
export const NOT_RECORDED = "Not recorded";

export interface BreakdownRow { projectId: string; sector: string; status: string; country: string; donorName: string; reportsOverdue: number; delivery: { band: string; lateActivities: number; valuesOverdue: number }; risks: { reviewOverdue: number } }

export interface BreakdownGroup { key: string; label: string; count: number; projectIds: string[] }

const valueOf = (row: BreakdownRow, by: BreakdownBy): string =>
  (by === "SECTOR" ? row.sector : by === "STATUS" ? row.status : by === "COUNTRY" ? row.country : row.donorName).trim();

const humanise = (by: BreakdownBy, v: string): string => {
  if (v === "") return NOT_RECORDED;
  if (by === "SECTOR" || by === "STATUS") return v.toLowerCase().split(/[_\s]+/).map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w)).join(" ");
  return v;
};

/** Largest group first, then by label; "Not recorded" always last so it never reads as the main group. */
export function groupProjects(rows: ReadonlyArray<BreakdownRow>, by: BreakdownBy): BreakdownGroup[] {
  const groups = new Map<string, BreakdownGroup>();
  for (const r of rows) {
    const raw = valueOf(r, by);
    const key = raw.toLowerCase();
    const g = groups.get(key) ?? { key: raw === "" ? "" : raw, label: humanise(by, raw), count: 0, projectIds: [] };
    g.count += 1; g.projectIds.push(r.projectId);
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => (a.key === "" ? 1 : b.key === "" ? -1 : b.count - a.count || a.label.localeCompare(b.label)));
}

export const ALERTS = ["reports-overdue", "late", "values-overdue", "risk-review", "behind"] as const;
export type HomeAlert = (typeof ALERTS)[number];
export const ALERT_LABEL: Record<HomeAlert, string> = {
  "reports-overdue": "with an overdue report", late: "with late planned activities", "values-overdue": "with overdue indicator values", "risk-review": "with a risk review overdue", behind: "that are behind or need attention",
};

const ALERT_TEST: Record<HomeAlert, (r: BreakdownRow) => boolean> = {
  "reports-overdue": (r) => r.reportsOverdue > 0,
  late: (r) => r.delivery.lateActivities > 0,
  "values-overdue": (r) => r.delivery.valuesOverdue > 0,
  "risk-review": (r) => r.risks.reviewOverdue > 0,
  behind: (r) => r.delivery.band === "OFF_TRACK" || r.delivery.band === "AT_RISK",
};

export const isBreakdownBy = (v: string | undefined): v is BreakdownBy => !!v && (BREAKDOWN_KEYS as readonly string[]).includes(v);
export const isHomeAlert = (v: string | undefined): v is HomeAlert => !!v && (ALERTS as readonly string[]).includes(v);

/** The rows a click selects: one group of one breakdown and/or one alert. Unknown values select nothing special (every row), never an error. */
export function filterProjects<T extends BreakdownRow>(rows: ReadonlyArray<T>, f: { by?: string | undefined; key?: string | undefined; alert?: string | undefined }): T[] {
  let out = [...rows];
  if (isBreakdownBy(f.by) && f.key !== undefined) { const by = f.by; const want = f.key.toLowerCase(); out = out.filter((r) => valueOf(r, by).toLowerCase() === want); }
  if (isHomeAlert(f.alert)) out = out.filter(ALERT_TEST[f.alert]);
  return out;
}
