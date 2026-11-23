import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { ActivitiesResponseSchema } from "@/lib/server/schemas";
import { InlineError } from "@/components/feedback/PageState";
import { WorkPlanResponseSchema } from "@/lib/server/schemas";
import { activitiesTabMode } from "@/features/workplan/domain/activities-tab-mode";
import { getProject } from "@/lib/server/project-queries";
import { showsButton } from "@/features/workplan/domain/role-surfaces";
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
  const mode = activitiesTabMode({
    planningVisible: !project.ok || project.value.showWorkPlanning !== false,
    plannedCount: plan.ok ? plan.value.items.length : 0,
    canPlan: showsButton(ctx.role, ctx.capabilities, "ADD_PLANNED"),
    view: "completed",
  });
  // Phase 65: the work plan has its own page; an old `?view=planned` address opens it.
  if (view === "planned") redirect(`/projects/${resolvedParams.id}/activities/plan`);
  const result = await gatewayRequest(`/v1/projects/${resolvedParams.id}/activities`, ActivitiesResponseSchema, ctx.token);
  if (!result.ok) {
    return (
      <div className="animate-fade-in">
        <header className="flex items-center justify-between">
          <h1 className="page-title">Activities done</h1>
          <Link className="btn" href={`/projects/${resolvedParams.id}/activities/new`}>New activity</Link>
        </header>
        <div className="mt-6"><InlineError title={result.error.message} referenceId={result.error.referenceId} /></div>
      </div>
    );
  }
  const items = result.value.items;

  return (
    <div className="animate-fade-in">
      {mode.otherSide === "PLAN" && (
        <p className="mb-4"><Link className="text-sm text-brand-700 hover:underline dark:text-brand-300" href={`/projects/${resolvedParams.id}/activities/plan`}>Work plan</Link></p>
      )}
      <header className="flex items-center justify-between">
        <h1 className="page-title">Activities done</h1>
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
