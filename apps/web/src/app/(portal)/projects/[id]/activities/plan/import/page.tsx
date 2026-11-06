import { notFound } from "next/navigation";
import { requireSession } from "@/lib/server/auth-context";
import { showsButton } from "@/features/workplan/domain/role-surfaces";
import { ImportWorkPlanForm } from "@/features/workplan/presentation/ImportWorkPlanForm";

export const dynamic = "force-dynamic";

export default async function ImportWorkPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireSession();
  if (!showsButton(ctx.role, ctx.capabilities, "ADD_PLANNED")) notFound();
  return <ImportWorkPlanForm projectId={id} />;
}
