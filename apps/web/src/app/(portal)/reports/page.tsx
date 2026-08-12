import Link from "next/link";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { ProjectsResponseSchema, ReportingPeriodsResponseSchema } from "@/lib/server/schemas";
import { InlineError, EmptyState } from "@/components/feedback/PageState";
import { Badge } from "@/components/data/Badge";
import { REPORT_STATUS_LABEL, REPORT_TYPE_LABEL } from "@/lib/labels";
import { reportStatusTone } from "@/lib/shared/tone";
import { deadlineUrgency, formatDate } from "@/lib/shared/dates";

export const dynamic = "force-dynamic";

export default async function GlobalReportsPage() {
  const ctx = await requireSession();
  const projectsResult = await gatewayRequest("/v1/projects", ProjectsResponseSchema, ctx.token);
  if (!projectsResult.ok) return <InlineError title={projectsResult.error.message} referenceId={projectsResult.error.referenceId} />;
  const periodResults = await Promise.all(projectsResult.value.items.map(async (project) => ({ project, result: await gatewayRequest(`/v1/projects/${project.id}/reporting-periods`, ReportingPeriodsResponseSchema, ctx.token) })));
  const reports = periodResults.flatMap(({ project, result }) => result.ok ? result.value.items.map((period) => ({ project, period })) : []);
  reports.sort((a, b) => a.period.daysUntilDeadline - b.period.daysUntilDeadline);
  const failed = periodResults.filter(({ result }) => !result.ok).length;

  return <div className="animate-fade-in">
    <header><p className="text-xs font-bold uppercase tracking-widest text-brand-600 dark:text-brand-400">Cross-project pipeline</p><h1 className="mt-1 text-3xl font-extrabold tracking-tight">Reports</h1><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Deadlines and readiness for every accessible project.</p></header>
    {failed > 0 && <div className="mt-5"><InlineError title={`${failed} project report ${failed === 1 ? "list is" : "lists are"} temporarily unavailable.`} /></div>}
    {reports.length === 0 ? <div className="mt-6"><EmptyState>No reporting periods are available. Open a project to create one.</EmptyState></div> : <div className="mt-6 space-y-3">{reports.map(({ project, period }) => {
      const urgency = deadlineUrgency(period.daysUntilDeadline);
      return <Link key={period.id} href={`/projects/${project.id}/reports/${period.id}`} className="card grid gap-3 transition hover:border-brand-400/40 sm:grid-cols-[1fr_auto_auto] sm:items-center">
        <div><div className="font-semibold">{project.title}</div><div className="text-xs text-slate-500">{REPORT_TYPE_LABEL[period.reportType] ?? period.reportType} · Deadline {formatDate(period.deadline)}</div></div>
        <div><div className="text-xs text-slate-500">Readiness</div><div className="font-bold">{period.readinessScore}%</div></div>
        <div className="flex flex-wrap gap-2 sm:justify-end"><Badge tone={urgency.tone}>{urgency.label}</Badge><Badge tone={reportStatusTone(period.status)}>{REPORT_STATUS_LABEL[period.status] ?? period.status.replace(/_/g, " ")}</Badge></div>
      </Link>;
    })}</div>}
  </div>;
}
