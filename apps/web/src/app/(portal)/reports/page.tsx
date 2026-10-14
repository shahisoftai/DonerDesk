import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { ProjectsResponseSchema, ReportingPeriodsResponseSchema, ExportsResponseSchema } from "@/lib/server/schemas";
import { InlineError, EmptyState } from "@/components/feedback/PageState";
import { ReportsList, type ReportRow } from "@/features/reports/presentation/ReportsList";
import { downloadsFor } from "@/features/reports/downloads-for";

export const dynamic = "force-dynamic";

export default async function GlobalReportsPage() {
  const ctx = await requireSession();
  const projectsResult = await gatewayRequest("/v1/projects", ProjectsResponseSchema, ctx.token);
  if (!projectsResult.ok) return <InlineError title={projectsResult.error.message} referenceId={projectsResult.error.referenceId} />;
  const periodResults = await Promise.all(projectsResult.value.items.map(async (project) => ({ project, result: await gatewayRequest(`/v1/projects/${project.id}/reporting-periods`, ReportingPeriodsResponseSchema, ctx.token) })));
  const exportResults = await Promise.all(projectsResult.value.items.map((project) => gatewayRequest(`/v1/projects/${project.id}/exports`, ExportsResponseSchema, ctx.token)));
  const rows: ReportRow[] = periodResults.flatMap(({ project, result }, i) => {
    if (!result.ok) return [];
    const exportItems = exportResults[i]?.ok ? exportResults[i].value.items : [];
    return result.value.items.filter((period) => !period.cancelled).map((period) => ({
      projectId: project.id, projectTitle: project.title, periodId: period.id, reportType: period.reportType, status: period.status,
      readinessScore: period.readinessScore, deadline: period.deadline, startDate: period.startDate, daysUntilDeadline: period.daysUntilDeadline,
      downloads: downloadsFor(exportItems.filter((e) => e.reportingPeriodId === period.id)),
    }));
  });
  const failed = periodResults.filter(({ result }) => !result.ok).length;

  return <div className="animate-fade-in">
    <header><p className="text-[10px] font-medium uppercase tracking-[0.12em] text-brand-600 dark:text-brand-400">Cross-project pipeline</p><h1 className="mt-1 text-xl font-semibold tracking-tight">Reports</h1><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Deadlines and readiness for every accessible project.</p></header>
    {failed > 0 && <div className="mt-5"><InlineError title={`${failed} project report ${failed === 1 ? "list is" : "lists are"} temporarily unavailable.`} /></div>}
    {rows.length === 0 ? <div className="mt-6"><EmptyState>No reporting periods are available. Open a project to create one.</EmptyState></div> : <ReportsList rows={rows} />}
  </div>;
}
