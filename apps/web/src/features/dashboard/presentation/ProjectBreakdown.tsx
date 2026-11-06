import Link from "next/link";
import { ALERTS, ALERT_LABEL, BREAKDOWN_KEYS, BREAKDOWN_LABEL, filterProjects, groupProjects, isBreakdownBy, isHomeAlert, type BreakdownRow } from "../domain/home-breakdown";

export interface HomeFilter { by?: string | undefined; key?: string | undefined; alert?: string | undefined }

const href = (f: HomeFilter): string => {
  const q = new URLSearchParams();
  if (f.by) q.set("by", f.by);
  if (f.key !== undefined && f.by) q.set("key", f.key);
  if (f.alert) q.set("alert", f.alert);
  const s = q.toString();
  return s ? `/dashboard?${s}` : "/dashboard";
};

/**
 * "Projects by …": how many projects by sector, status, country or funder, as bars. A click filters the project health table below (the address carries the choice,
 * so it can be shared and bookmarked); alert chips do the same for the problems a director scans for. Counts only: nothing here rates a project.
 */
export function ProjectBreakdown({ rows, filter }: { rows: ReadonlyArray<BreakdownRow>; filter: HomeFilter }) {
  const by = isBreakdownBy(filter.by) ? filter.by : "SECTOR";
  const groups = groupProjects(rows, by);
  const max = Math.max(1, ...groups.map((g) => g.count));
  const active = isBreakdownBy(filter.by) && filter.key !== undefined ? filter.key.toLowerCase() : null;
  const alertCounts = ALERTS.map((a) => ({ a, n: filterProjects(rows, { alert: a }).length }));
  return (
    <div className="space-y-3">
      <nav aria-label="Group projects by" className="flex flex-wrap gap-2">
        {BREAKDOWN_KEYS.map((k) => (
          <Link key={k} href={href({ by: k, ...(filter.alert ? { alert: filter.alert } : {}) })} aria-current={k === by ? "true" : undefined}
            className={`rounded-full border px-3 py-1 text-xs ${k === by ? "border-brand-600 bg-brand-50 font-medium text-brand-700 dark:bg-white/10 dark:text-brand-300" : "border-slate-300 text-slate-600 dark:border-white/20 dark:text-slate-300"}`}>{BREAKDOWN_LABEL[k]}</Link>
        ))}
      </nav>
      <ul className="space-y-1.5">
        {groups.map((g) => {
          const on = active !== null && g.key.toLowerCase() === active;
          return (
            <li key={g.label}>
              <Link href={on ? href({ ...(filter.alert ? { alert: filter.alert } : {}) }) : href({ by, key: g.key, ...(filter.alert ? { alert: filter.alert } : {}) })} aria-pressed={on}
                className="grid grid-cols-[minmax(0,9rem)_1fr_2rem] items-center gap-2 text-sm hover:underline">
                <span className={`truncate ${on ? "font-semibold" : ""}`}>{g.label}</span>
                <span className="h-2 rounded bg-slate-200 dark:bg-white/10" aria-hidden="true"><span className={`block h-full rounded ${on ? "bg-brand-700" : "bg-brand-500"}`} style={{ width: `${(g.count / max) * 100}%` }} /></span>
                <span className="tabular-nums text-end">{g.count}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap gap-2 border-t border-slate-200/70 pt-2 dark:border-white/10">
        {alertCounts.filter((x) => x.n > 0 || filter.alert === x.a).map(({ a, n }) => (
          <Link key={a} href={filter.alert === a ? href({ ...(filter.by ? { by: filter.by } : {}), ...(filter.key !== undefined ? { key: filter.key } : {}) }) : href({ ...(filter.by ? { by: filter.by } : {}), ...(filter.key !== undefined ? { key: filter.key } : {}), alert: a })} aria-pressed={filter.alert === a}
            className={`rounded-full border px-3 py-1 text-xs ${filter.alert === a ? "border-danger-600 font-medium" : "border-slate-300 dark:border-white/20"}`}>{n} {ALERT_LABEL[a]}</Link>
        ))}
      </div>
    </div>
  );
}

/** "Showing 3 of 9 — clear": said whenever a filter is on. */
export function FilterNote({ shown, total, filter }: { shown: number; total: number; filter: HomeFilter }) {
  const on = (isBreakdownBy(filter.by) && filter.key !== undefined) || isHomeAlert(filter.alert);
  if (!on) return null;
  return <p className="mb-2 text-xs text-slate-600 dark:text-slate-300">Showing {shown} of {total} projects. <Link className="font-medium text-brand-700 hover:underline dark:text-brand-300" href="/dashboard">Clear</Link></p>;
}
