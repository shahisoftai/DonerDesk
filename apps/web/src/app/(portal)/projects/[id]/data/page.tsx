import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { DataSheetResponseSchema } from "@/lib/server/schemas";
import { InlineError } from "@/components/feedback/PageState";
import { DataCenter } from "@/features/data-center/presentation/DataCenter";
import { BreakdownProgressSchema } from "@/lib/server/schemas-breakdown";
import { BreakdownProgressTable } from "@/features/workplan/presentation/BreakdownProgressTable";

export const dynamic = "force-dynamic";

export default async function DataCenterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireSession();
  const result = await gatewayRequest(`/v1/projects/${encodeURIComponent(id)}/data-sheet`, DataSheetResponseSchema, ctx.token);
  if (!result.ok) return <InlineError title={result.error.message} referenceId={result.error.referenceId} />;
  // Targets by group beside the verified figure so far: shown only for indicators that have group targets.
  const groups = await gatewayRequest(`/v1/projects/${encodeURIComponent(id)}/breakdown-progress`, BreakdownProgressSchema, ctx.token);
  return (
    <div data-tour-id="data-center">
      <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
        <a className="btn-secondary" href={`/visuals/charts/${id}`}>Chart Studio</a>
        <a className="btn-secondary" href={`/visuals/maps/${id}`}>Map</a>
        {ctx.capabilities.has("indicator.update") && <a className="btn-primary" href={`/projects/${id}/import`}>Bring in data</a>}
      </div>
      <DataCenter projectId={id} sheet={result.value} canEdit={ctx.capabilities.has("indicator.update")} canEditReports={ctx.capabilities.has("reporting.edit")} canReopenReports={ctx.capabilities.has("report.approve")} />
      {groups.ok && <BreakdownProgressTable items={groups.value.items} />}
    </div>
  );
}
