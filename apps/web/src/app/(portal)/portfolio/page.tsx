import Link from "next/link";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { PortfolioOverviewSchema } from "@/lib/server/schemas";
import { InlineError } from "@/components/feedback/PageState";

export const dynamic = "force-dynamic";

const BAND_STYLE: Record<string, string> = {
  OFF_TRACK: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300",
  AT_RISK: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
  ON_TRACK: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
  NO_PLAN: "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300",
};

const deadlineText = (days: number): string => (days < 0 ? `${-days} day${days === -1 ? "" : "s"} overdue` : days === 0 ? "due today" : `in ${days} day${days === 1 ? "" : "s"}`);

/**
 * Every live project you can see on one page: how delivery stands, open problems and risks, and the next report. The most pressing
 * projects come first. Nothing here is a score: each column says what it counts, and a missing figure is shown as missing.
 */
export default async function PortfolioDashboardPage() {
  const ctx = await requireSession();
  const res = await gatewayRequest("/v1/portfolio/overview", PortfolioOverviewSchema, ctx.token);
  if (!res.ok) return <InlineError title={res.error.message} referenceId={res.error.referenceId} />;
  const { totals, rows } = res.value;
  const tiles: Array<[string, number]> = [
    ["Projects", totals.projects],
    ["Behind", totals.behind],
    ["Need attention", totals.needAttention],
    ["Open problems and risks", totals.openRisks],
    ["Serious", totals.highRisks],
    ["Reports overdue", totals.reportsOverdue],
  ];
  return (
    <div className="animate-fade-in space-y-6">
      <header>
        <h2 className="text-xl font-semibold tracking-tight">Portfolio</h2>
        <p className="mt-1 text-sm text-slate-500">Delivery, problems and risks, and reporting for every live project you can see, most pressing first.</p>
        <p className="mt-2 flex flex-wrap gap-2"><Link className="btn-secondary" href="/portfolio/indicators">Indicators across projects</Link><Link className="btn-secondary" href="/portfolio/infographics">Infographics</Link><Link className="btn-secondary" href="/programmes">Programmes and grants</Link></p>
      </header>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {tiles.map(([label, value]) => (
          <div key={label} className="card">
            <dt className="text-xs text-slate-500">{label}</dt>
            <dd className="mt-1 text-2xl font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      {rows.length === 0 && <p className="text-sm text-slate-600 dark:text-slate-300">No live projects yet.</p>}
      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[56rem] text-left text-sm">
            <caption className="sr-only">Projects with delivery, risks and the next report</caption>
            <thead className="text-xs text-slate-500">
              <tr>
                <th scope="col" className="py-2 pr-3">Project</th>
                <th scope="col" className="py-2 pr-3">Delivery</th>
                <th scope="col" className="py-2 pr-3">Problems and risks</th>
                <th scope="col" className="py-2 pr-3">Next report</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-white/10">
              {rows.map((r) => (
                <tr key={r.projectId} className="align-top">
                  <td className="py-3 pr-3">
                    <Link href={`/projects/${r.projectId}`} className="font-medium text-brand-700 hover:underline dark:text-brand-300">{r.title}</Link>
                    <p className="text-xs text-slate-500">{[r.donorName, r.country].filter(Boolean).join(" · ")}</p>
                  </td>
                  <td className="py-3 pr-3">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${BAND_STYLE[r.delivery.band] ?? ""}`}>{r.delivery.label}</span>
                    {r.delivery.reason && <p className="mt-1 text-xs text-slate-500">{r.delivery.reason}</p>}
                    {(r.delivery.lateActivities > 0 || r.delivery.valuesOverdue > 0) && (
                      <p className="mt-1 text-xs text-slate-500">
                        {r.delivery.lateActivities > 0 ? `${r.delivery.lateActivities} late ${r.delivery.lateActivities === 1 ? "activity" : "activities"}` : ""}
                        {r.delivery.lateActivities > 0 && r.delivery.valuesOverdue > 0 ? " · " : ""}
                        {r.delivery.valuesOverdue > 0 ? `${r.delivery.valuesOverdue} ${r.delivery.valuesOverdue === 1 ? "value" : "values"} overdue` : ""}
                      </p>
                    )}
                  </td>
                  <td className="py-3 pr-3">
                    {r.risks.open === 0 ? <span className="text-slate-500">Nothing open</span> : (
                      <>
                        <span>{r.risks.open} open</span>
                        {r.risks.high > 0 && <span className="text-red-700 dark:text-red-300"> · {r.risks.high} serious</span>}
                        {r.risks.reviewOverdue > 0 && <p className="text-xs text-amber-700 dark:text-amber-300">{r.risks.reviewOverdue} past review date</p>}
                      </>
                    )}
                  </td>
                  <td className="py-3 pr-3">
                    {r.reporting ? (
                      <>
                        <Link href={`/projects/${r.projectId}/reports`} className="hover:underline">{deadlineText(r.reporting.daysUntil)}</Link>
                        <p className="text-xs text-slate-500">{r.reporting.status.replace(/_/g, " ").toLowerCase()} · {r.reporting.readinessScore}% ready</p>
                        {r.reportsOverdue > 1 && <p className="text-xs text-red-700 dark:text-red-300">{r.reportsOverdue} reports overdue</p>}
                      </>
                    ) : <span className="text-slate-500">No report scheduled</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
