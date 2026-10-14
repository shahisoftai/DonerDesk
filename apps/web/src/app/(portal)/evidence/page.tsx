import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { EvidenceResponseSchema, ProjectsResponseSchema } from "@/lib/server/schemas";
import { InlineError, EmptyState } from "@/components/feedback/PageState";
import { EvidenceList } from "@/features/reports/presentation/EvidenceList";

export const dynamic = "force-dynamic";

export default async function GlobalEvidencePage() {
  const ctx = await requireSession();
  const [result, projects] = await Promise.all([
    gatewayRequest("/v1/evidence/search", EvidenceResponseSchema, ctx.token, { method: "POST", body: { page: 1, pageSize: 200 } }),
    gatewayRequest("/v1/projects", ProjectsResponseSchema, ctx.token),
  ]);
  const titles = new Map((projects.ok ? projects.value.items : []).map((p) => [p.id, p.title]));

  return (
    <div className="animate-fade-in">
      <header>
        <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-brand-600 dark:text-brand-400">Cross-project queue</p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">Evidence</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Review evidence across the projects you are allowed to access.</p>
      </header>
      {!result.ok && <div className="mt-6"><InlineError title={result.error.message} referenceId={result.error.referenceId} /></div>}
      {result.ok && result.value.items.length === 0 && <div className="mt-6"><EmptyState>No evidence yet. Open a project to upload evidence.</EmptyState></div>}
      {result.ok && result.value.items.length > 0 && <>
        <EvidenceList rows={result.value.items.map((i) => ({ id: i.id, projectId: i.projectId, projectTitle: (i.projectId && titles.get(i.projectId)) || "", title: i.title, fileName: i.fileName, evidenceType: i.evidenceType, verificationStatus: i.verificationStatus, confidentialityLevel: i.confidentialityLevel }))} />
        {result.value.total > result.value.items.length && <p className="mt-3 text-xs text-slate-500">Showing the most recent {result.value.items.length} of {result.value.total} files.</p>}
      </>}
    </div>
  );
}
