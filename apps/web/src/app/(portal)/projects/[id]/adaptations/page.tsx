import Link from "next/link";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { AdaptationsResponseSchema, LogframeResponseSchema, ReportingPeriodsResponseSchema } from "@/lib/server/schemas";
import { InlineError } from "@/components/feedback/PageState";
import { periodOptionLabel, recentFirst } from "@/lib/shared/option-labels";
import { hasCapability } from "@/lib/server/auth-context";
import { AdaptationForm } from "@/features/projects/presentation/AdaptationForm";

export const dynamic = "force-dynamic";

/** Every change of plan, newest first: what changed, why, and what it did to the results. */
export default async function AdaptationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireSession();
  const [log, logframe, periods] = await Promise.all([
    gatewayRequest(`/v1/projects/${id}/adaptations`, AdaptationsResponseSchema, ctx.token),
    gatewayRequest(`/v1/projects/${id}/logframe`, LogframeResponseSchema, ctx.token),
    gatewayRequest(`/v1/projects/${id}/reporting-periods`, ReportingPeriodsResponseSchema, ctx.token),
  ]);
  if (!log.ok) return <InlineError title={log.error.message} referenceId={log.error.referenceId} />;
  const indicators = logframe.ok ? logframe.value.indicators.map((i) => ({ id: i.id, label: `${i.code} ${i.name}` })) : [];
  const periodOptions = periods.ok ? recentFirst(periods.value.items, (p) => p.startDate).map((p) => ({ id: p.id, label: periodOptionLabel(p) })) : [];
  const indicatorLabel = new Map(indicators.map((i) => [i.id, i.label]));
  const periodLabel = new Map(periodOptions.map((p) => [p.id, p.label]));
  return (
    <div className="animate-fade-in space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Changes of plan</h1>
        <p className="mt-1 text-sm text-slate-500">When something changes, write down what, why, and what it does to the results. The report can then explain it, and a statement about it can be checked.</p>
        <p className="mt-2"><Link className="btn-secondary" href={`/projects/${id}/management-report`}>Management report</Link></p>
      </header>
      {hasCapability(ctx, "risk.raise") && <AdaptationForm projectId={id} indicators={indicators} periods={periodOptions} />}
      {log.value.items.length === 0 ? (
        <p className="text-sm text-slate-600 dark:text-slate-300">No changes recorded yet.</p>
      ) : (
        <ol className="space-y-3">
          {log.value.items.map((a) => (
            <li key={a.id} className="card space-y-1">
              <p className="text-xs text-slate-500">{a.recordedOn}</p>
              <p className="font-medium">{a.whatChanged}</p>
              <p className="text-sm"><span className="text-slate-500">Why: </span>{a.why}</p>
              {a.effectOnResults && <p className="text-sm"><span className="text-slate-500">Effect on results: </span>{a.effectOnResults}</p>}
              {(a.indicatorId || a.reportingPeriodId) && (
                <p className="text-xs text-slate-500">
                  {a.indicatorId && <>Indicator: {indicatorLabel.get(a.indicatorId) ?? "removed"}. </>}
                  {a.reportingPeriodId && <>Report: {periodLabel.get(a.reportingPeriodId) ?? "removed"}.</>}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
