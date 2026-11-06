import Link from "next/link";
import { Badge } from "@/components/data/Badge";
import { CollapsedPanel, Panel } from "../HomeParts";
import { DeadlineTiles, PaceBar, PaceLegend as PaceLegendBar, PipelineBoard, ResultsBars, RisksList } from "../HomeWidgets";
import { FilterNote } from "../ProjectBreakdown";
import { dueLabel } from "../../domain/home-derive";
import type { PortfolioHomeData } from "../../application/portfolio-home-model";

const BAND_TONE = { ON_TRACK: "success", AT_RISK: "warning", OFF_TRACK: "danger", NO_PLAN: "neutral" } as const;
/** Home shows the most pressing projects; the whole table is on the Portfolio page. */
export const HEALTH_ROWS_SHOWN = 5;

export function ProjectHealthPanel(d: PortfolioHomeData) {
  if (!d.overview.ok) return null;
  const { rows, shownRows, extra, filter } = d;
  return (
    <Panel title="Project health" href="/portfolio" linkLabel={shownRows.length > HEALTH_ROWS_SHOWN ? `All ${shownRows.length} projects →` : "Open portfolio →"}>
      <FilterNote shown={shownRows.length} total={rows.length} filter={filter} />
      {rows.length > 0 && <PaceLegendBar />}
      {rows.length === 0 ? (
        <p className="card text-sm text-slate-600 dark:text-slate-300">No live projects yet. <Link className="font-medium text-brand-600 hover:underline dark:text-brand-400" href="/projects/new">Create your first project</Link>.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200/70 bg-white dark:border-white/10 dark:bg-white/[0.03]">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
                <th className="px-3 py-2 font-medium">Project</th><th className="px-3 py-2 font-medium">Delivery</th><th className="px-3 py-2 font-medium">Results</th><th className="px-3 py-2 font-medium">Budget</th><th className="px-3 py-2 font-medium">Risks</th><th className="px-3 py-2 font-medium">Next report</th>
              </tr>
            </thead>
            <tbody>
              {shownRows.slice(0, HEALTH_ROWS_SHOWN).map((r) => {
                const insight = extra.insights.get(r.projectId);
                return (
                  <tr key={r.projectId} className="border-t border-slate-200/70 hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5">
                    <td className="px-3 py-2.5"><Link href={`/projects/${r.projectId}`} className="block font-medium hover:underline">{r.title}</Link><span className="text-xs text-slate-500 dark:text-slate-400">{r.donorName} · {r.country}</span></td>
                    <td className="px-3 py-2.5"><Badge tone={BAND_TONE[r.delivery.band]}>{r.delivery.label}</Badge>{r.delivery.reason && <div className="mt-1 max-w-[220px] text-xs text-slate-500 dark:text-slate-400">{r.delivery.reason}</div>}</td>
                    <td className="px-3 py-2.5">{insight ? <PaceBar reading={insight.results} tone="results" /> : <span className="text-xs text-slate-400">—</span>}</td>
                    <td className="px-3 py-2.5">{insight ? <PaceBar reading={insight.budget} tone="budget" /> : <span className="text-xs text-slate-400">—</span>}</td>
                    <td className="px-3 py-2.5 tabular-nums">{r.risks.open}{r.risks.high > 0 && <span className="ml-1 text-xs text-danger-600 dark:text-danger-400">({r.risks.high} serious)</span>}</td>
                    <td className="px-3 py-2.5">{r.reporting ? <Link href={`/projects/${r.projectId}/reports/${r.reporting.periodId}`} className="hover:underline"><span className={r.reporting.daysUntil < 0 ? "font-medium text-danger-600 dark:text-danger-400" : ""}>{dueLabel(r.reporting.daysUntil)}</span><span className="block text-xs text-slate-500 dark:text-slate-400">{r.reporting.readinessScore}% ready</span></Link> : <span className="text-xs text-slate-500 dark:text-slate-400">None scheduled</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

export function UpcomingReportsPanel(d: PortfolioHomeData) {
  if (!d.overview.ok) return null;
  if (d.upcoming.length === 0) return <CollapsedPanel title="Upcoming reports" message="No reporting deadlines yet." href="/reports" linkLabel="All reports →" />;
  return <Panel title="Upcoming reports" href="/reports" linkLabel="All reports →"><DeadlineTiles items={d.upcoming} /></Panel>;
}

export function PipelinePanel(d: PortfolioHomeData) {
  if (!d.overview.ok) return null;
  if (d.extra.periods.length === 0) return <CollapsedPanel title="Report pipeline" message="No reports in progress." href="/reports" linkLabel="All reports →" />;
  return <Panel title="Report pipeline" href="/reports" linkLabel="All reports →"><PipelineBoard periods={d.extra.periods} /></Panel>;
}

export function RisksPanel(d: PortfolioHomeData) {
  if (!d.overview.ok) return null;
  if (d.extra.risks.length === 0) return <CollapsedPanel title="Risks and problems" message="None open." href="/portfolio" linkLabel="Portfolio →" />;
  return <Panel title="Risks and problems" href="/portfolio" linkLabel="Portfolio →"><RisksList risks={d.extra.risks} /></Panel>;
}

export function ResultsPanel(d: PortfolioHomeData) {
  if (!d.overview.ok) return null;
  if (d.rows.length === 0) return <CollapsedPanel title="Results against target" message="No live projects yet." />;
  return (
    <Panel title="Results against target" href="/portfolio/indicators" linkLabel="Indicators →">
      <ResultsBars rows={d.rows.slice(0, 6).map((r) => ({ projectId: r.projectId, title: r.title, reading: d.extra.insights.get(r.projectId)?.results ?? { value: null, timeElapsed: 0, ahead: null } }))} />
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Latest share of target for each project&apos;s main indicator. Rates are left out.</p>
    </Panel>
  );
}
