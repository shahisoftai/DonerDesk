import Link from "next/link";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { InlineError } from "@/components/feedback/PageState";
import { MapLayerMetaSchema, PlanFieldValuesSchema, RisksResponseSchema, WorkPlanResponseSchema, ReportingPeriodsResponseSchema } from "@/lib/server/schemas";
import { fieldChips } from "@/features/workplan/domain/plan-export";
import { WORKPLAN_COPY, canActOnPlanItem } from "@donordesk/domain/contexts/workplan/index.js";
import { showsButton, surfaceFor, managesPlan } from "@/features/workplan/domain/role-surfaces";
import { PlanEmptyCard } from "@/features/workplan/presentation/PlanEmptyCard";
import { canReachProjectPage } from "@/features/projects/domain/role-project-pages";
import { PlannedViews } from "@/features/workplan/presentation/PlannedViews";
import { deadlinesFromPeriods } from "@/features/workplan/domain/timeline-deadlines";
import type { Role } from "@/lib/shared/capabilities";
import { loadPlanPageData } from "@/features/workplan/application/plan-page-data";

export const dynamic = "force-dynamic";

// The links to plan/start, plan/new and plan/import are plain anchors on purpose: a client-side Link is caught by the
// @panel/(.)plan/[itemId] interception, which reads "start" as an activity id and shows a 404.

/** The Work plan (Phase 65): its own page, the planned side of what `/activities` used to switch between. */
export default async function WorkPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PlannedActivitiesView projectId={id} />;
}

async function PlannedActivitiesView({ projectId }: { projectId: string }) {
  const data = await loadPlanPageData(projectId);
  const [plan, periods, planFields, risks, mapLayer] = await Promise.all([
    gatewayRequest(`/v1/projects/${projectId}/work-plan`, WorkPlanResponseSchema, data.ctx.token),
    gatewayRequest(`/v1/projects/${projectId}/reporting-periods`, ReportingPeriodsResponseSchema, data.ctx.token),
    gatewayRequest(`/v1/projects/${projectId}/plan-field-values`, PlanFieldValuesSchema, data.ctx.token),
    gatewayRequest(`/v1/projects/${projectId}/risks`, RisksResponseSchema, data.ctx.token),
    gatewayRequest("/v1/organization/map-layer", MapLayerMetaSchema, data.ctx.token),
  ]);
  // A few words per activity for the project's own fields: only fields that have a value.
  const chips: Record<string, string[]> = planFields.ok
    ? Object.fromEntries(Object.entries(planFields.value.values).map(([itemId, own]) => [itemId, fieldChips(planFields.value.fields, own)]))
    : {};
  const surface = surfaceFor(data.ctx.role);
  const canPlan = showsButton(data.ctx.role, data.ctx.capabilities, "ADD_PLANNED");
  const canStart = showsButton(data.ctx.role, data.ctx.capabilities, "START_FROM_LOGFRAME");
  const canUpdateOwn = showsButton(data.ctx.role, data.ctx.capabilities, "UPDATE_OWN_STATUS");
  const rows = plan.ok ? plan.value.items : [];
  const actor = { userId: data.userId, role: (data.ctx.role ?? "VIEWER") as Role };
  return (
    <div data-tour-id="work-plan" className="animate-fade-in">
      <header className="flex items-center justify-between">
        <h1 className="page-title">Work plan</h1>
        {canPlan && rows.length > 0 && (
          <div className="flex gap-2">
            <a className="btn-secondary text-xs" href={`/projects/${projectId}/activities/plan/import`}>{WORKPLAN_COPY.importSheet}</a>
            <a className="btn" href={`/projects/${projectId}/activities/plan/new`}>{WORKPLAN_COPY.addPlanned}</a>
          </div>
        )}
      </header>
      <p className="mt-2 flex flex-wrap gap-x-4 text-sm">
        {canReachProjectPage(data.ctx.role, "/activities") && <Link className="text-brand-700 hover:underline dark:text-brand-300" href={`/projects/${projectId}/activities`}>Activities done</Link>}
        {canReachProjectPage(data.ctx.role, "/beneficiaries") && <Link className="text-brand-700 hover:underline dark:text-brand-300" href={`/projects/${projectId}/beneficiaries`}>People reached</Link>}
      </p>
      <div className="mt-4">
        {!plan.ok ? (
          <InlineError title={plan.error.message} referenceId={plan.error.referenceId} />
        ) : rows.length === 0 ? (
          <PlanEmptyCard projectId={projectId} canPlan={canPlan && canStart} />
        ) : (
          <PlannedViews
            canExport={data.ctx.capabilities.has("results.view")}
            projectId={projectId}
            rows={rows}
            today={data.today}
            userId={data.userId}
            names={data.names}
            fieldChips={chips}
            initialView={surface.planView}
            defaultMine={surface.mineFilter}
            defaultActuals={managesPlan(data.ctx.role)}
            deadlines={deadlinesFromPeriods(periods.ok ? periods.value.items : [])}
            project={data.projectRange}
            outputTitles={data.outputTitles}
            changeableIds={rows.filter((row) => canPlan || (canUpdateOwn && (row.ownerUserId === data.userId || row.supportUserIds.includes(data.userId)))).map((row) => row.id)}
            movableIds={rows.filter((row) => canActOnPlanItem(actor, { ownerUserId: row.ownerUserId, supportUserIds: row.supportUserIds }, "MOVE")).map((row) => row.id)}
            siteRisks={risks.ok ? risks.value.items.map((r) => ({ title: r.title, plannedActivityId: r.plannedActivityId, status: r.status })) : []}
            country={data.country}
            mapLayerUrl={mapLayer.ok && mapLayer.value ? "/api/organization/map-layer/data" : undefined}
          />
        )}
      </div>
    </div>
  );
}
