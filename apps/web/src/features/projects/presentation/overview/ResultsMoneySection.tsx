import { countOf } from "@donordesk/domain/core/plural.js";
import { Badge } from "@/components/data/Badge";
import type { ResultsData } from "@/features/projects/application/overview-view";
import { Bar, CardHead, OverviewSection } from "./overview-pieces";

/**
 * Will we deliver, and will the money last: every indicator beside the clock, the trend of the
 * project's headline indicator, and the money by quarter.
 *
 * The gap between what was reached and the share of time elapsed is shown, never turned into a
 * score, and a rate is never read as a share of target.
 */
export function ResultsMoneySection({ results, projectId }: { results: ResultsData; projectId: string }) {
  const clock = results.timeElapsedPercent;
  return (
    <OverviewSection kicker="Results & money" title="Progress against targets, and the money" href={`/projects/${projectId}/data`} linkLabel="Open the Data Center">
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card">
          <CardHead title="Progress against targets" note={`beside time elapsed ${clock}%`} />
          {results.indicators.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">No indicators are set up yet.</p>
          ) : (
            <ul className="mt-2 divide-y divide-slate-200/70 dark:divide-white/10">
              {results.indicators.map((indicator) => (
                <li key={indicator.id} className="py-2.5 text-sm">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{indicator.code}</span>
                    <span className="min-w-0 flex-1 truncate">{indicator.name}</span>
                    {indicator.isRate ? (
                      <span className="tabular-nums text-slate-500">—</span>
                    ) : indicator.percent === null ? (
                      <Badge tone="neutral">Not measured</Badge>
                    ) : (
                      <span className="tabular-nums font-semibold">{indicator.percent}%</span>
                    )}
                  </div>
                  {indicator.isRate ? (
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      Baseline {indicator.baseline || "—"} · target {indicator.target || "—"} · latest {indicator.latest || "—"}
                    </p>
                  ) : indicator.percent === null ? (
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">No value has been recorded for this indicator yet.</p>
                  ) : (
                    <>
                      <div className="mt-1.5">
                        <Bar value={indicator.percent} tone={indicator.percent + 2 < clock ? "warning" : "success"} />
                      </div>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {indicator.percent + 2 < clock
                          ? `${clock - indicator.percent} points behind the clock`
                          : "At or ahead of the clock"}
                      </p>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            No projection is made: the gap to the clock is shown and the reading stays yours.
          </p>
        </div>

        <div className="card">
          <CardHead
            title="Cumulative achievement"
            note={results.headline ? `${results.headline.indicator.code} · % of target` : "No indicator has recorded values"}
          />
          {results.headline && results.headline.series.some((point) => point.percent !== null) ? (
            <>
              <div className="mt-4 flex h-28 items-end gap-2">
                {results.headline.series.map((point) => (
                  <div key={point.periodId} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
                    <span className="text-[10px] tabular-nums text-slate-500 dark:text-slate-400">
                      {point.percent === null ? "—" : `${point.percent}%`}
                    </span>
                    <div
                      className={`w-full max-w-[2.25rem] rounded-t ${point.percent === null ? "bg-slate-200/70 dark:bg-white/10" : "bg-brand-500"}`}
                      style={{ height: `${Math.max(2, point.percent ?? 0)}%` }}
                    />
                    <span className="w-full truncate text-center text-[10px] text-slate-500 dark:text-slate-400">{point.label}</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                A period with nothing recorded is left empty, never drawn as zero.
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Nothing has been recorded yet.</p>
          )}
        </div>

        <div className="card">
          <CardHead title="Money by quarter" note="cumulative to the end of each period" />
          {results.finance.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">No finance figures are recorded for this project.</p>
          ) : (
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    <th scope="col" className="py-1.5 pr-3">Period</th>
                    <th scope="col" className="py-1.5 pr-3 text-right">Budget</th>
                    <th scope="col" className="py-1.5 pr-3 text-right">Spent</th>
                    <th scope="col" className="py-1.5 text-right">Burn</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 dark:divide-white/10">
                  {results.finance.map((row) => (
                    <tr key={row.periodId}>
                      <td className="py-1.5 pr-3">
                        {row.label}{" "}
                        <Badge tone={row.verified ? "success" : "warning"}>{row.verified ? "Verified" : "Draft"}</Badge>
                      </td>
                      <td className="py-1.5 pr-3 text-right font-mono tabular-nums">{row.budget || "—"}</td>
                      <td className="py-1.5 pr-3 text-right font-mono tabular-nums">{row.expenditure || "—"}</td>
                      <td className="py-1.5 text-right tabular-nums">{row.burn ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {results.budgetPace.length > 0 ? (
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              {results.budgetPace
                .map((pace) => `${pace.currency}: ${pace.spentPercent ?? "—"}% spent${pace.verifiedThrough ? ` · verified through ${pace.verifiedThrough}` : ""}`)
                .join(" · ")}
            </p>
          ) : null}
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {countOf(results.finance.filter((row) => row.verified).length, "verified period", "verified periods")} · only verified figures reach a report.
          </p>
        </div>
      </div>
    </OverviewSection>
  );
}
