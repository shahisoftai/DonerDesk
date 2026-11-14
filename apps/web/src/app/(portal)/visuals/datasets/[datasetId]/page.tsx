import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { DataSheetResponseSchema } from "@/lib/server/schemas";
import { InlineError } from "@/components/feedback/PageState";
import { ShellTabs } from "@/features/visual-studio/presentation/ShellTabs";
import { DatasetPage } from "@/features/datasets/presentation/DatasetPage";
import { getDatasetAction, listDatasetKitsAction } from "@/lib/actions/datasets";

export const dynamic = "force-dynamic";

export default async function DatasetDetailPage({ params, searchParams }: { params: Promise<{ datasetId: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { datasetId } = await params;
  const { tab } = await searchParams;
  const ctx = await requireSession();
  const [d, kits] = await Promise.all([getDatasetAction(datasetId), listDatasetKitsAction()]);
  if (!d.ok) return <InlineError title={d.error.message} referenceId={d.error.referenceId} />;
  const sheet = d.value.projectId ? await gatewayRequest(`/v1/projects/${encodeURIComponent(d.value.projectId)}/data-sheet`, DataSheetResponseSchema, ctx.token) : null;
  const indicators = sheet && sheet.ok ? sheet.value.indicators.map((i) => ({ id: i.id, code: i.code, name: i.name, type: i.type })) : [];
  return (
    <div className="animate-fade-in space-y-4">
      <h1 className="text-xl font-semibold tracking-tight">Visual Studio</h1>
      <ShellTabs active="datasets" />
      <p className="text-xs"><a className="hover:underline" href="/visuals/datasets">Datasets</a></p>
      <DatasetPage dataset={d.value} kits={kits.ok ? kits.value.kits : []} indicators={indicators} isAdmin={ctx.capabilities.has("org.manage")} initialTab={tab} />
    </div>
  );
}
