import Link from "next/link";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { DataSheetResponseSchema } from "@/lib/server/schemas";
import { SavedChartListSchema } from "@/lib/server/schemas-charts";
import { InlineError } from "@/components/feedback/PageState";
import { ChartStudio } from "@/features/charts/presentation/ChartStudio";

export const dynamic = "force-dynamic";

/** The Maps (Phase 34.4): the project's results by place as maps and rankings, saved as views, with the places as KML and GeoJSON. */
export default async function MapsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireSession();
  const [sheet, saved] = await Promise.all([
    gatewayRequest(`/v1/projects/${encodeURIComponent(id)}/data-sheet`, DataSheetResponseSchema, ctx.token),
    gatewayRequest(`/v1/charts?projectId=${encodeURIComponent(id)}`, SavedChartListSchema, ctx.token),
  ]);
  if (!sheet.ok) return <InlineError title={sheet.error.message} referenceId={sheet.error.referenceId} />;
  return (
    <>
      <p className="mb-3 text-sm"><Link className="underline" href={`/projects/${id}/data`}>Data Center</Link> · <Link className="underline" href={`/projects/${id}/charts`}>Chart Studio</Link></p>
      <ChartStudio mode="map"
        projectId={id}
        indicators={sheet.value.indicators.map((i) => ({ id: i.id, code: i.code, name: i.name, unit: i.unit, isRate: i.isRate }))}
        periods={sheet.value.periods.map((p) => ({ id: p.id, label: p.label }))}
        initialCharts={saved.ok ? saved.value.charts : []}
        canShare={ctx.capabilities.has("project.edit")}
      />
    </>
  );
}
