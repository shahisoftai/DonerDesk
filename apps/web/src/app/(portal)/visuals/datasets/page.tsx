import { requireSession } from "@/lib/server/auth-context";
import { InlineError } from "@/components/feedback/PageState";
import { ShellTabs } from "@/features/visual-studio/presentation/ShellTabs";
import { DatasetList } from "@/features/datasets/presentation/DatasetList";
import { listDatasetKitsAction, listDatasetsAction } from "@/lib/actions/datasets";

export const dynamic = "force-dynamic";

/** Datasets (Phase 54): tables the organisation brought in, and the kits that turn one into dashboards. */
export default async function DatasetsPage() {
  await requireSession();
  const [list, kits] = await Promise.all([listDatasetsAction(), listDatasetKitsAction()]);
  if (!list.ok) return <InlineError title={list.error.message} referenceId={list.error.referenceId} />;
  return (
    <div className="page-stack animate-fade-in">
      <h1 className="page-title">Visual Studio</h1>
      <ShellTabs active="datasets" />
      <DatasetList datasets={list.value.datasets} kits={kits.ok ? kits.value.kits : []} canCreate={list.value.canCreate} />
    </div>
  );
}
