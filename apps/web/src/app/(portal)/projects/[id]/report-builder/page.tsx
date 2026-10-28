import Link from "next/link";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { DataSheetResponseSchema } from "@/lib/server/schemas";
import { SavedReportListSchema } from "@/lib/server/schemas-saved-reports";
import { InlineError } from "@/components/feedback/PageState";
import { ReportBuilder } from "@/features/report-builder/presentation/ReportBuilder";

export const dynamic = "force-dynamic";

/** Saved reports (Phase 34.5): ask for results across indicators in one sentence, run it, keep it. */
export default async function ReportBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireSession();
  const [sheet, saved] = await Promise.all([
    gatewayRequest(`/v1/projects/${encodeURIComponent(id)}/data-sheet`, DataSheetResponseSchema, ctx.token),
    gatewayRequest(`/v1/saved-reports?projectId=${encodeURIComponent(id)}`, SavedReportListSchema, ctx.token),
  ]);
  if (!sheet.ok) return <InlineError title={sheet.error.message} referenceId={sheet.error.referenceId} />;
  return (
    <>
      <p className="mb-3 text-sm"><Link className="underline" href={`/projects/${id}/data`}>Data Center</Link></p>
      <ReportBuilder
        projectId={id}
        indicators={sheet.value.indicators.map((i) => ({ id: i.id, code: i.code, name: i.name }))}
        periods={sheet.value.periods.map((p) => ({ id: p.id, label: p.label }))}
        initialReports={saved.ok ? saved.value.reports : []}
        canShare={ctx.capabilities.has("project.edit")}
      />
    </>
  );
}
