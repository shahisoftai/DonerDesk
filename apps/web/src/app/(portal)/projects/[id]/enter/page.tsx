import Link from "next/link";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { LogframeResponseSchema, ReportingPeriodsResponseSchema, WorkPlanResponseSchema } from "@/lib/server/schemas";
import { PlaceListSchema, PlaceResultsSchema } from "@/lib/server/schemas-places";
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
  const [logframe, periods, profile, placeList, plan, results] = await Promise.all([
    gatewayRequest(`/v1/projects/${id}/logframe`, LogframeResponseSchema, ctx.token),
    gatewayRequest(`/v1/projects/${id}/reporting-periods`, ReportingPeriodsResponseSchema, ctx.token),
    loadReportingProfileAction(id),
    gatewayRequest("/v1/places", PlaceListSchema, ctx.token),
    gatewayRequest(`/v1/projects/${id}/work-plan`, WorkPlanResponseSchema, ctx.token),
    gatewayRequest(`/v1/projects/${id}/place-results?level=1`, PlaceResultsSchema, ctx.token),
  ]);
  // The places this project already uses: named by its planned work, or holding a recorded figure.
  const used = new Set<string>();
  if (plan.ok) for (const item of plan.value.items) for (const p of item.places ?? []) used.add(p.id);
  if (results.ok) for (const ind of results.value.indicators) for (const row of ind.rollup.rows) used.add(row.placeId);
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
            indicators={logframe.value.indicators.map((i) => ({ id: i.id, code: i.code, name: i.name, unit: i.unit, type: i.type, disaggregationRequired: i.disaggregationRequired, recordByPlace: i.recordByPlace, placeLevel: i.placeLevel ?? undefined, formula: i.formula }))}
            places={placeList.ok ? placeList.value.places.map((p) => ({ id: p.id, name: p.name, adminLevel: p.adminLevel, archived: p.archived, path: p.path })) : undefined}
            usedPlaceIds={[...used]}
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
