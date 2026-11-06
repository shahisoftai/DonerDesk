import { notFound } from "next/navigation";
import { loadPlanPageData } from "@/features/workplan/application/plan-page-data";
import { StartFromLogframeWizard } from "@/features/workplan/presentation/StartFromLogframeWizard";
import { showsButton } from "@/features/workplan/domain/role-surfaces";

export const dynamic = "force-dynamic";

export default async function StartPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadPlanPageData(id);
  if (!showsButton(data.ctx.role, data.ctx.capabilities, "START_FROM_LOGFRAME")) notFound();
  return (
    <div className="animate-fade-in">
      <h1 className="text-xl font-semibold tracking-tight">Start from my logframe</h1>
      {data.logframeActivities.length === 0 ? (
        <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">This logframe has no activities yet. Add them in the logframe first, or add a planned activity by hand.</p>
      ) : (
        <div className="mt-6"><StartFromLogframeWizard projectId={id} activities={data.logframeActivities} leads={data.leads} /></div>
      )}
    </div>
  );
}
