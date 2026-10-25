import { requireSession } from "@/lib/server/auth-context";
import { InlineError } from "@/components/feedback/PageState";
import { InfographicsList } from "@/features/infographics/presentation/InfographicsList";

export const dynamic = "force-dynamic";

export default async function ProjectInfographicsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireSession();
  return (
    <InfographicsList projectId={id} canEdit={ctx.capabilities.has("reporting.edit")} canExport={ctx.capabilities.has("export.create")} />
  );
}
