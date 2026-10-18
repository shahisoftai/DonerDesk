import { notFound } from "next/navigation";
import { loadPlanPageData } from "@/features/workplan/application/plan-page-data";
import { PlanActivityForm } from "@/features/workplan/presentation/PlanActivityForm";
import { showsButton } from "@/features/workplan/domain/role-surfaces";

export const dynamic = "force-dynamic";

export default async function NewPlannedActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadPlanPageData(id);
  if (!showsButton(data.ctx.role, data.ctx.capabilities, "ADD_PLANNED")) notFound();
  return (
    <div className="animate-fade-in">
      <h1 className="text-xl font-semibold tracking-tight">Add planned activity</h1>
      <div className="mt-6">
        <PlanActivityForm projectId={id} leads={data.leads} activities={data.logframeActivities.map((a) => ({ id: a.id, label: a.title }))} />
      </div>
    </div>
  );
}
