import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { IndicatorUpdateHistoryResponseSchema, LogframeResponseSchema } from "@/lib/server/schemas";
import { InlineError } from "@/components/feedback/PageState";
import { Badge } from "@/components/data/Badge";
import { IndicatorSemanticsCard } from "@/features/logframe/presentation/IndicatorSemanticsCard";
import { IndicatorProgressCard } from "@/features/logframe/presentation/IndicatorProgressCard";
import { IndicatorVerificationPipeline } from "@/features/logframe/presentation/IndicatorVerificationPipeline";
import { IndicatorHistoryPanel } from "@/features/logframe/presentation/IndicatorHistoryPanel";

export const dynamic = "force-dynamic";

export default async function IndicatorDetailPage({ params }: { params: Promise<{ id: string; indicatorId: string }> }) {
  const { id, indicatorId } = await params;
  const ctx = await requireSession();
  const [result, history] = await Promise.all([
    gatewayRequest(`/v1/projects/${id}/logframe`, LogframeResponseSchema, ctx.token),
    gatewayRequest(`/v1/indicators/${encodeURIComponent(indicatorId)}/updates`, IndicatorUpdateHistoryResponseSchema, ctx.token),
  ]);
  if (!result.ok) return <InlineError title={result.error.message} referenceId={result.error.referenceId} />;
  const indicator = result.value.indicators.find((item) => item.id === indicatorId);
  if (!indicator) notFound();
  const updates = history.ok ? history.value.updates : [];
  const latest = [...updates].reverse().find((u) => u.cumulativeAchievement.trim() !== "") ?? null;
  return <div className="animate-fade-in"><header className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-mono text-xs text-slate-500">{indicator.code}</p><h2 className="mt-1 text-xl font-semibold tracking-tight">{indicator.name}</h2><p className="mt-1 text-sm text-slate-500">Indicator definition and reporting context</p></div><Link className="btn-secondary" href={`/projects/${id}/logframe`}>Back to logframe</Link></header>
    <div className="mt-6 grid gap-4 lg:grid-cols-2"><section className="card"><h3 className="font-medium">Measurement</h3><dl className="mt-4 grid grid-cols-2 gap-4 text-sm"><Metric label="Baseline" value={indicator.baseline || "Not set"} /><Metric label="Target" value={`${indicator.target || "Not set"}${indicator.unit ? ` ${indicator.unit}` : ""}`} /><Metric label="Type" value={indicator.type?.replace(/_/g, " ") ?? "Not set"} /><Metric label="Frequency" value={indicator.frequency?.replace(/_/g, " ") ?? "Not set"} /></dl></section>
    <section className="card"><h3 className="font-medium">Verification</h3><p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{indicator.meansOfVerification || "No means of verification has been recorded."}</p><div className="mt-4"><Badge tone={indicator.meansOfVerification ? "success" : "warning"}>{indicator.meansOfVerification ? "Source defined" : "Source needed"}</Badge></div>{indicator.dataSource && <p className="mt-3 text-xs text-slate-500">Data source: {indicator.dataSource}</p>}</section></div>
    <IndicatorSemanticsCard
      indicatorId={indicator.id}
      current={indicator.semantics ?? null}
      candidates={result.value.indicators.filter((item) => item.id !== indicator.id).map((item) => ({ id: item.id, label: `${item.code} — ${item.name}` }))}
    />
    <IndicatorProgressCard baseline={indicator.baseline} target={indicator.target} unit={indicator.unit ?? undefined} latest={latest} />
    {history.ok ? <>
      <IndicatorVerificationPipeline statuses={updates.map((u) => u.verificationStatus)} />
      <IndicatorHistoryPanel rows={updates} unit={indicator.unit ?? undefined} canReview={ctx.capabilities.has("indicator.verify")} />
    </> : <div className="mt-4"><InlineError title={history.error.message} referenceId={history.error.referenceId} /></div>}
  </div>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div><dt className="text-[11px] font-medium text-slate-500">{label}</dt><dd className="mt-1 font-medium capitalize">{value.toLowerCase()}</dd></div>; }
