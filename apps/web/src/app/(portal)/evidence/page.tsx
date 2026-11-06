import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { EvidenceResponseSchema, ProjectsResponseSchema } from "@/lib/server/schemas";
import { InlineError, EmptyState } from "@/components/feedback/PageState";
import { EvidenceList } from "@/features/reports/presentation/EvidenceList";
import { EvidenceFilterBar } from "@/features/evidence/presentation/EvidenceFilterBar";
import { parseEvidenceFilters, projectIdsFor } from "@/lib/shared/evidence-filters";

export const dynamic = "force-dynamic";

/**
 * Evidence across the projects the person can see, filterable by project, donor, country, status, confidentiality, type and
 * where it was collected. Donor and country belong to a project, not to the file, so they keep the files of matching projects.
 */
export default async function GlobalEvidencePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const entries: Array<[string, string]> = [];
  for (const [key, value] of Object.entries(raw)) if (typeof value === "string") entries.push([key, value]);
  const filters = parseEvidenceFilters(entries);
  const ctx = await requireSession();
  const [result, projects] = await Promise.all([
    gatewayRequest("/v1/evidence/search", EvidenceResponseSchema, ctx.token, {
      method: "POST",
      body: {
        query: filters.query,
        projectId: filters.projectId,
        verificationStatus: filters.verificationStatus,
        confidentialityLevel: filters.confidentialityLevel,
        evidenceType: filters.evidenceType,
        location: filters.location,
        page: 1,
        pageSize: 200,
      },
    }),
    gatewayRequest("/v1/projects", ProjectsResponseSchema, ctx.token),
  ]);
  const projectList = projects.ok ? projects.value.items : [];
  const titles = new Map(projectList.map((p) => [p.id, p.title]));
  const allowed = projectIdsFor(projectList, filters);
  const items = result.ok ? result.value.items.filter((i) => !allowed || (i.projectId !== undefined && allowed.has(i.projectId))) : [];
  const donors = [...new Set(projectList.map((p) => p.donorName).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const countries = [...new Set(projectList.map((p) => p.country).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const queryString = new URLSearchParams(entries).toString();
  const filtered = Object.keys(filters).length > 0;

  return (
    <div className="animate-fade-in">
      <header>
        <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-brand-600 dark:text-brand-400">Cross-project queue</p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">Evidence</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Review evidence across the projects you are allowed to access.</p>
      </header>
      <div className="mt-4">
        <EvidenceFilterBar
          baseUrl="/evidence"
          current={queryString}
          options={{ projects: projectList.map((p) => ({ id: p.id, label: p.title })), donors, countries, location: true }}
        />
      </div>
      {!result.ok && <div className="mt-6"><InlineError title={result.error.message} referenceId={result.error.referenceId} /></div>}
      {result.ok && items.length === 0 && (
        <div className="mt-6"><EmptyState>{filtered ? "No evidence matches these filters." : "No evidence yet. Open a project to upload evidence."}</EmptyState></div>
      )}
      {result.ok && items.length > 0 && <>
        <EvidenceList rows={items.map((i) => ({ id: i.id, projectId: i.projectId, projectTitle: (i.projectId && titles.get(i.projectId)) || "", title: i.title, fileName: i.fileName, evidenceType: i.evidenceType, verificationStatus: i.verificationStatus, confidentialityLevel: i.confidentialityLevel }))} />
        {result.value.total > result.value.items.length && <p className="mt-3 text-xs text-slate-500">Showing the most recent {result.value.items.length} of {result.value.total} files{allowed ? " (donor and country are applied to these)" : ""}.</p>}
      </>}
    </div>
  );
}
