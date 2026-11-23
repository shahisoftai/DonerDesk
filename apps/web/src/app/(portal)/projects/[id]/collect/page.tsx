import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { CollectionFormListSchema } from "@/lib/server/schemas-collection";
import { listDatasetsAction } from "@/lib/actions/datasets";
import { PageHeader } from "@/components/layout/Page";
import { AddDataCards } from "@/features/projects/presentation/collect/AddDataCards";
import type { ProjectFact } from "@/features/projects/domain/project-stages";

export const dynamic = "force-dynamic";

/** Collect (Phase 65): one door for every way to add data. The Record button opens the same kinds as a quick sheet. */
export default async function CollectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireSession();
  const [forms, datasets] = await Promise.all([
    gatewayRequest(`/v1/projects/${encodeURIComponent(id)}/collection-forms`, CollectionFormListSchema, ctx.token),
    listDatasetsAction(id),
  ]);
  const facts = new Set<ProjectFact>([
    ...(forms.ok && forms.value.forms.length > 0 ? (["FORMS"] as const) : []),
    ...(datasets.ok && datasets.value.datasets.length > 0 ? (["DATASETS"] as const) : []),
  ]);
  return (
    <div className="page-stack animate-fade-in" data-tour-id="add-data">
      <PageHeader title="Add data" description="Choose what you have. Each way opens the screen for that job, and everything you add is checked the same way." />
      <AddDataCards projectId={id} capabilities={ctx.capabilities} facts={facts} role={ctx.role} />
    </div>
  );
}
