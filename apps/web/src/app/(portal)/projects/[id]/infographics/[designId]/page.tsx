import { notFound } from "next/navigation";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { DataSheetResponseSchema } from "@/lib/server/schemas";
import { InfographicDataSchema, InfographicRecordSchema } from "@/lib/server/schemas-infographics";
import { z } from "zod";
import { InlineError } from "@/components/feedback/PageState";
import { InfographicStudio } from "@/features/infographics/presentation/InfographicStudio";
import type { InfographicData } from "@/features/infographics/domain/studio-view";

export const dynamic = "force-dynamic";

export default async function InfographicStudioPage({ params }: { params: Promise<{ id: string; designId: string }> }) {
  const { id, designId } = await params;
  const ctx = await requireSession();
  const [design, data, sheet, brand] = await Promise.all([
    gatewayRequest(`/v1/infographics/${encodeURIComponent(designId)}`, InfographicRecordSchema, ctx.token),
    gatewayRequest(`/v1/projects/${encodeURIComponent(id)}/infographic-data`, InfographicDataSchema, ctx.token),
    gatewayRequest(`/v1/projects/${encodeURIComponent(id)}/data-sheet`, DataSheetResponseSchema, ctx.token),
    gatewayRequest("/v1/infographic-brand", z.object({ brand: z.unknown().nullable() }), ctx.token),
  ]);
  if (!design.ok) {
    if (design.error.kind === "not_found") notFound();
    return <InlineError title={design.error.message} referenceId={design.error.referenceId} />;
  }
  if (!data.ok) return <InlineError title={data.error.message} referenceId={data.error.referenceId} />;
  if (!sheet.ok) return <InlineError title={sheet.error.message} referenceId={sheet.error.referenceId} />;

  return (
    <InfographicStudio
      projectId={id}
      design={design.value}
      data={data.value as unknown as InfographicData}
      sheet={sheet.value as never}
      canEdit={ctx.capabilities.has("reporting.edit")}
      canExport={ctx.capabilities.has("export.create")}
      canApprove={ctx.capabilities.has("report.approve")}
      canManageBrand={ctx.capabilities.has("org.manage")}
      hasBrandKit={brand.ok && brand.value.brand !== null}
    />
  );
}
