import Link from "next/link";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { LogframeResponseSchema, ReportingPeriodsResponseSchema } from "@/lib/server/schemas";
import { loadReportingProfileAction } from "@/lib/actions/setup";
import { InlineError } from "@/components/feedback/PageState";
import { InlineAlert } from "@/components/feedback/InlineAlert";
import { ValueFormHost } from "@/features/record/presentation/ValueFormHost";

export const dynamic = "force-dynamic";

/** Enter data: one indicator, one value, one day. The reporting period is found from the day. */
export default async function EnterDataPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ indicator?: string }> }) {
  const { id } = await params;
  const { indicator } = await searchParams;
  const ctx = await requireSession();
  const [logframe, periods, profile] = await Promise.all([
    gatewayRequest(`/v1/projects/${id}/logframe`, LogframeResponseSchema, ctx.token),
    gatewayRequest(`/v1/projects/${id}/reporting-periods`, ReportingPeriodsResponseSchema, ctx.token),
    loadReportingProfileAction(id),
  ]);
  if (!logframe.ok) return <InlineError title={logframe.error.message} referenceId={logframe.error.referenceId} />;
  if (!periods.ok) return <InlineError title={periods.error.message} referenceId={periods.error.referenceId} />;
  const canEnter = ctx.capabilities.has("indicator.update");

  return (
    <div className="animate-fade-in">
      <h2 className="text-xl font-semibold tracking-tight">Enter data</h2>
      <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
        Pick an indicator, type the value and the day it is for. DonerDesk finds the reporting period for you. To enter many values at once, use the <Link className="underline" href={`/projects/${id}/reports`}>period&rsquo;s sheet</Link>, or <Link className="underline" href={`/projects/${id}/import`}>bring in a file</Link>.
      </p>
      <div className="mt-5 max-w-2xl">
        {canEnter ? (
          <ValueFormHost
            projectId={id}
            indicators={logframe.value.indicators.map((i) => ({ id: i.id, code: i.code, name: i.name, unit: i.unit, type: i.type, disaggregationRequired: i.disaggregationRequired, formula: i.formula }))}
            periods={periods.value.items.map((p) => ({ id: p.id, reportType: p.reportType, startDate: p.startDate, endDate: p.endDate, cancelled: p.cancelled, status: p.status }))}
            initialIndicatorId={indicator}
            simpleReview={profile.ok ? profile.value.profile?.simpleReview === true : false}
            canOpenPeriod={ctx.capabilities.has("project.edit")}
          />
        ) : (
          <InlineAlert tone="info" title="You can look but not enter">Your role cannot enter indicator values on this project. Ask a project manager for access.</InlineAlert>
        )}
      </div>
    </div>
  );
}
