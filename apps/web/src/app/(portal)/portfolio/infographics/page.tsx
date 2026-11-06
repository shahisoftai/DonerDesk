import { requireSession } from "@/lib/server/auth-context";
import { InfographicsList } from "@/features/infographics/presentation/InfographicsList";

export const dynamic = "force-dynamic";

/** Infographics that cover every project the person can see (the portfolio), kept under the organization rather than a project. */
export default async function PortfolioInfographicsPage() {
  const ctx = await requireSession();
  return <InfographicsList scope="PORTFOLIO" projectId="portfolio" canEdit={ctx.capabilities.has("reporting.edit")} canExport={ctx.capabilities.has("export.create")} canManageBrand={ctx.capabilities.has("org.manage")} />;
}
