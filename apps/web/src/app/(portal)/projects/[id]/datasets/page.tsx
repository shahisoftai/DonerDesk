import { requireSession } from "@/lib/server/auth-context";
import { InlineError } from "@/components/feedback/PageState";
import { DatasetList } from "@/features/datasets/presentation/DatasetList";
import { listDatasetKitsAction, listDatasetsAction } from "@/lib/actions/datasets";

export const dynamic = "force-dynamic";

/** A project's datasets (Phase 54 §4.1), with the organisation's own listed beside them. */
export default async function ProjectDatasetsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireSession();
  const [list, kits] = await Promise.all([listDatasetsAction(id), listDatasetKitsAction()]);
  if (!list.ok) return <InlineError title={list.error.message} referenceId={list.error.referenceId} />;
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Datasets</h2>
      <DatasetList datasets={list.value.datasets} kits={kits.ok ? kits.value.kits : []} canCreate={list.value.canCreate} projectId={id} />
    </div>
  );
}
