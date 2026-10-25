import { notFound } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { InfographicRecordSchema } from "@/lib/server/schemas-infographics";
import { InlineError } from "@/components/feedback/PageState";
import { InfographicStudio } from "@/features/infographics/presentation/InfographicStudio";
import type { InfographicData } from "@/features/infographics/domain/studio-view";

export const dynamic = "force-dynamic";

const PortfolioDataSchema = z.object({
  asAt: z.string(),
  countries: z.array(z.object({ country: z.string(), projects: z.number(), offTrack: z.number(), atRisk: z.number(), onTrack: z.number(), noPlan: z.number().optional() })),
});

/** What the Studio's single-project parts see on a portfolio page: nothing (the portfolio blocks read the portfolio themselves). */
const NO_PROJECT: InfographicData = {
  projectId: "portfolio",
  project: { title: "Portfolio", projectCode: "", donorName: "", sector: "", country: "", start: "", end: "", status: "ACTIVE" },
  periods: [],
  periodOrder: [],
  indicators: [],
  reach: { overallUnique: 0, registeredTotal: 0, registeredByLocation: [], attendancesByActivityLocation: [], beneficiariesWithoutLocation: 0, attendancesWithoutLocation: 0, bySex: {}, byAgeGroup: {} },
  activities: { rows: [], unlocated: 0 },
  finance: { enabled: false, rows: [] },
  provenance: { generatedAt: "", unverifiedValues: 0, locationTrackedIndicators: 0, projectWideIndicators: 0 },
};

export default async function PortfolioInfographicStudioPage({ params }: { params: Promise<{ designId: string }> }) {
  const { designId } = await params;
  const ctx = await requireSession();
  const [design, portfolio, brand] = await Promise.all([
    gatewayRequest(`/v1/infographics/${encodeURIComponent(designId)}`, InfographicRecordSchema, ctx.token),
    gatewayRequest("/v1/portfolio/infographic-data", PortfolioDataSchema.passthrough(), ctx.token),
    gatewayRequest("/v1/infographic-brand", z.object({ brand: z.unknown().nullable() }), ctx.token),
  ]);
  if (!design.ok) {
    if (design.error.kind === "not_found") notFound();
    return <InlineError title={design.error.message} referenceId={design.error.referenceId} />;
  }
  if (!portfolio.ok) return <InlineError title={portfolio.error.message} referenceId={portfolio.error.referenceId} />;
  return (
    <InfographicStudio
      scope="PORTFOLIO"
      projectId="portfolio"
      design={design.value}
      data={NO_PROJECT}
      sheet={{ projectId: "portfolio", periods: [], indicators: [], cells: [], finance: [] } as never}
      portfolioCountries={portfolio.value.countries}
      canEdit={ctx.capabilities.has("reporting.edit")}
      canExport={ctx.capabilities.has("export.create")}
      canApprove={ctx.capabilities.has("report.approve")}
      canManageBrand={ctx.capabilities.has("org.manage")}
      hasBrandKit={brand.ok && brand.value.brand !== null}
    />
  );
}
