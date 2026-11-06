import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { ProjectsResponseSchema, ReportingPeriodsResponseSchema, ChecklistResponseSchema } from "@/lib/server/schemas";
import { InlineError, EmptyState } from "@/components/feedback/PageState";
import { ComplianceList } from "@/features/reports/presentation/ComplianceList";

export const dynamic = "force-dynamic";

export default async function GlobalCompliancePage() {
  const ctx = await requireSession();
  const projectsResult = await gatewayRequest("/v1/projects", ProjectsResponseSchema, ctx.token);
  if (!projectsResult.ok) return <InlineError title={projectsResult.error.message} referenceId={projectsResult.error.referenceId} />;
  const periodsByProject = await Promise.all(projectsResult.value.items.map(async (project) => ({ project, result: await gatewayRequest(`/v1/projects/${project.id}/reporting-periods`, ReportingPeriodsResponseSchema, ctx.token) })));
  const periodRows = periodsByProject.flatMap(({ project, result }) => result.ok ? result.value.items.map((period) => ({ project, period })) : []);
  const checklistResults = await Promise.all(periodRows.map(async (row) => ({ ...row, result: await gatewayRequest(`/v1/reporting-periods/${row.period.id}/checklist`, ChecklistResponseSchema, ctx.token) })));
  const items = checklistResults.flatMap(({ project, period, result }) => result.ok ? result.value.items.filter((item) => item.status !== "RESOLVED").map((item) => ({ project, period, item })) : []);
  const rows = items.map(({ project, period, item }) => ({ id: item.id, projectId: project.id, projectTitle: project.title, periodId: period.id, title: item.title, description: item.description, severity: item.severity, status: item.status, dueDate: item.dueDate }));
  const failures = periodsByProject.filter(({ result }) => !result.ok).length + checklistResults.filter(({ result }) => !result.ok).length;

  return <div className="animate-fade-in">
    <header><p className="text-[10px] font-medium uppercase tracking-[0.12em] text-brand-600 dark:text-brand-400">Cross-project queue</p><h1 className="mt-1 text-xl font-semibold tracking-tight">Compliance</h1><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Open requirements across accessible reporting periods.</p></header>
    {failures > 0 && <div className="mt-5"><InlineError title="Some compliance data is temporarily unavailable; available items are shown below." /></div>}
    {rows.length === 0 ? <div className="mt-6"><EmptyState>No open compliance gaps are available.</EmptyState></div> : <ComplianceList rows={rows} />}
  </div>;
}
