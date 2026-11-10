import Link from "next/link";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { DataSheetResponseSchema } from "@/lib/server/schemas";
import { SavedChartListSchema } from "@/lib/server/schemas-charts";
import { InlineError } from "@/components/feedback/PageState";
import { LazyChartStudio } from "./LazyStudios";

/** The Chart Studio for one project. The project page and the Visual Studio both draw this, so the two cannot drift apart. */
export async function ChartStudioPanel({ projectId }: { projectId: string }) {
  const ctx = await requireSession();
  const [sheet, saved] = await Promise.all([
    gatewayRequest(`/v1/projects/${encodeURIComponent(projectId)}/data-sheet`, DataSheetResponseSchema, ctx.token),
    gatewayRequest(`/v1/charts?projectId=${encodeURIComponent(projectId)}`, SavedChartListSchema, ctx.token),
  ]);
  if (!sheet.ok) return <InlineError title={sheet.error.message} referenceId={sheet.error.referenceId} />;
  return (
    <>
      <p className="mb-3 text-sm"><Link className="underline" href={`/projects/${projectId}/data`}>Data Center</Link></p>
      <LazyChartStudio
        projectId={projectId}
        indicators={sheet.value.indicators.map((i) => ({ id: i.id, code: i.code, name: i.name, unit: i.unit, isRate: i.isRate }))}
        periods={sheet.value.periods.map((p) => ({ id: p.id, label: p.label }))}
        initialCharts={saved.ok ? saved.value.charts : []}
        canShare={ctx.capabilities.has("project.edit")}
      />
    </>
  );
}
