import Link from "next/link";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { ActivitiesResponseSchema } from "@/lib/server/schemas";
import { InlineError } from "@/components/feedback/PageState";
import { WorkPlanResponseSchema } from "@/lib/server/schemas";
import { WORKPLAN_COPY } from "@donordesk/domain/contexts/workplan/index.js";
import { activitiesTabMode } from "@/features/workplan/domain/activities-tab-mode";
import { getProject } from "@/lib/server/project-queries";
import { showsButton, surfaceFor } from "@/features/workplan/domain/role-surfaces";
import { PlanEmptyCard } from "@/features/workplan/presentation/PlanEmptyCard";
import { PlannedViews } from "@/features/workplan/presentation/PlannedViews";
import { deadlinesFromPeriods } from "@/features/workplan/domain/timeline-deadlines";
import { ReportingPeriodsResponseSchema } from "@/lib/server/schemas";
import { canActOnPlanItem } from "@donordesk/domain/contexts/workplan/index.js";
import type { Role } from "@/lib/shared/capabilities";
import { loadPlanPageData } from "@/features/workplan/application/plan-page-data";
import { ActivityBulkList } from "@/features/activities/presentation/ActivityBulkList";

export const dynamic = "force-dynamic";

export default async function ActivitiesPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ view?: string }> }) {
  const resolvedParams = await params;
  const { view } = await searchParams;
  const ctx = await requireSession();
  // A project with no plan looks exactly as before (see activitiesTabMode).
  const [project, plan] = await Promise.all([
    getProject(ctx.token, resolvedParams.id),
    gatewayRequest(`/v1/projects/${resolvedParams.id}/work-plan`, WorkPlanResponseSchema, ctx.token),
  ]);
  const { showSwitch, planned } = activitiesTabMode({
    role: ctx.role,
    planningVisible: !project.ok || project.value.showWorkPlanning !== false,
    plannedCount: plan.ok ? plan.value.items.length : 0,
    canPlan: showsButton(ctx.role, ctx.capabilities, "ADD_PLANNED"),
    view,
  });
  if (planned) return <PlannedActivitiesView projectId={resolvedParams.id} />;
  const result = await gatewayRequest(`/v1/projects/${resolvedParams.id}/activities`, ActivitiesResponseSchema, ctx.token);
  if (!result.ok) {
    return (
      <div className="animate-fade-in">
        <header className="flex items-center justify-between">
          <h1 className="text-xl font-semibold tracking-tight">Activity updates</h1>
          <Link className="btn" href={`/projects/${resolvedParams.id}/activities/new`}>New activity</Link>
        </header>
        <div className="mt-6"><InlineError title={result.error.message} referenceId={result.error.referenceId} /></div>
      </div>
    );
  }
  const items = result.value.items;

  return (
    <div className="animate-fade-in">
      {showSwitch && <ActivitiesSwitch projectId={resolvedParams.id} current="completed" />}
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Activity updates</h1>
        <div className="flex gap-2">
          <a className="btn-secondary text-xs" href="/api/templates/activities">Download template</a>
          <Link className="btn-secondary text-xs" href={`/projects/${resolvedParams.id}/activities/import`}>Import</Link>
          <Link className="btn" href={`/projects/${resolvedParams.id}/activities/new`}>New activity</Link>
        </div>
      </header>
      <ActivityBulkList projectId={resolvedParams.id} items={items} canReview={ctx.capabilities.has("activity.review")} />
    </div>
  );
}

function ActivitiesSwitch({ projectId, current }: { projectId: string; current: "planned" | "completed" }) {
  const tab = (key: "planned" | "completed", label: string) => (
    <Link
      href={`/projects/${projectId}/activities?view=${key}`}
      aria-current={current === key ? "page" : undefined}
      className={`rounded-full px-3 py-1 text-sm ${current === key ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-200"}`}
    >
      {label}
    </Link>
  );
  return <nav aria-label="Activities" className="mb-4 flex flex-wrap items-center gap-2">{tab("planned", WORKPLAN_COPY.tabPlanned)}{tab("completed", WORKPLAN_COPY.tabCompleted)}<Link className="ml-auto text-sm text-brand-700 hover:underline dark:text-brand-300" href={`/projects/${projectId}/beneficiaries`}>People reached</Link></nav>;
}

async function PlannedActivitiesView({ projectId }: { projectId: string }) {
  const data = await loadPlanPageData(projectId);
  const [plan, periods] = await Promise.all([
    gatewayRequest(`/v1/projects/${projectId}/work-plan`, WorkPlanResponseSchema, data.ctx.token),
    gatewayRequest(`/v1/projects/${projectId}/reporting-periods`, ReportingPeriodsResponseSchema, data.ctx.token),
  ]);
  const surface = surfaceFor(data.ctx.role);
  const canPlan = showsButton(data.ctx.role, data.ctx.capabilities, "ADD_PLANNED");
  const canStart = showsButton(data.ctx.role, data.ctx.capabilities, "START_FROM_LOGFRAME");
  const canUpdateOwn = showsButton(data.ctx.role, data.ctx.capabilities, "UPDATE_OWN_STATUS");
  const rows = plan.ok ? plan.value.items : [];
  const actor = { userId: data.userId, role: (data.ctx.role ?? "VIEWER") as Role };
  return (
    <div className="animate-fade-in">
      <ActivitiesSwitch projectId={projectId} current="planned" />
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Planned activities</h1>
        {canPlan && rows.length > 0 && (
          <div className="flex gap-2">
            <Link className="btn-secondary text-xs" href={`/projects/${projectId}/activities/plan/import`}>{WORKPLAN_COPY.importSheet}</Link>
            <Link className="btn" href={`/projects/${projectId}/activities/plan/new`}>{WORKPLAN_COPY.addPlanned}</Link>
          </div>
        )}
      </header>
      <div className="mt-4">
        {!plan.ok ? (
          <InlineError title={plan.error.message} referenceId={plan.error.referenceId} />
        ) : rows.length === 0 ? (
          <PlanEmptyCard projectId={projectId} canPlan={canPlan && canStart} />
        ) : (
          <PlannedViews
            projectId={projectId}
            rows={rows}
            today={data.today}
            userId={data.userId}
            names={data.names}
            initialView={surface.planView}
            defaultMine={surface.mineFilter}
            deadlines={deadlinesFromPeriods(periods.ok ? periods.value.items : [])}
            project={data.projectRange}
            outputTitles={data.outputTitles}
            changeableIds={rows.filter((row) => canPlan || (canUpdateOwn && (row.ownerUserId === data.userId || row.supportUserIds.includes(data.userId)))).map((row) => row.id)}
            movableIds={rows.filter((row) => canActOnPlanItem(actor, { ownerUserId: row.ownerUserId, supportUserIds: row.supportUserIds }, "MOVE")).map((row) => row.id)}
          />
        )}
      </div>
    </div>
  );
}
