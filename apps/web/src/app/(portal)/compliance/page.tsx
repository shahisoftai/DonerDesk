import Link from "next/link";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { ProjectsResponseSchema, ReportingPeriodsResponseSchema, ChecklistResponseSchema } from "@/lib/server/schemas";
import { InlineError, EmptyState } from "@/components/feedback/PageState";
import { Badge } from "@/components/data/Badge";
import { checklistStatusTone, severityTone } from "@/lib/shared/tone";
import { CHECKLIST_STATUS_LABEL, SEVERITY_LABEL } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function GlobalCompliancePage() {
  const ctx = await requireSession();
  const projectsResult = await gatewayRequest("/v1/projects", ProjectsResponseSchema, ctx.token);
  if (!projectsResult.ok) return <InlineError title={projectsResult.error.message} referenceId={projectsResult.error.referenceId} />;
  const periodsByProject = await Promise.all(projectsResult.value.items.map(async (project) => ({ project, result: await gatewayRequest(`/v1/projects/${project.id}/reporting-periods`, ReportingPeriodsResponseSchema, ctx.token) })));
  const periodRows = periodsByProject.flatMap(({ project, result }) => result.ok ? result.value.items.map((period) => ({ project, period })) : []);
  const checklistResults = await Promise.all(periodRows.map(async (row) => ({ ...row, result: await gatewayRequest(`/v1/reporting-periods/${row.period.id}/checklist`, ChecklistResponseSchema, ctx.token) })));
  const items = checklistResults.flatMap(({ project, period, result }) => result.ok ? result.value.items.filter((item) => item.status !== "RESOLVED").map((item) => ({ project, period, item })) : []);
  const severityRank: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  items.sort((a, b) => (severityRank[a.item.severity] ?? 9) - (severityRank[b.item.severity] ?? 9));
  const failures = periodsByProject.filter(({ result }) => !result.ok).length + checklistResults.filter(({ result }) => !result.ok).length;

  return <div className="animate-fade-in">
    <header><p className="text-xs font-bold uppercase tracking-widest text-brand-600 dark:text-brand-400">Cross-project queue</p><h1 className="mt-1 text-3xl font-extrabold tracking-tight">Compliance</h1><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Open requirements ordered by risk across accessible reporting periods.</p></header>
    {failures > 0 && <div className="mt-5"><InlineError title="Some compliance data is temporarily unavailable; available items are shown below." /></div>}
    {items.length === 0 ? <div className="mt-6"><EmptyState>No open compliance gaps are available.</EmptyState></div> : <div className="mt-6 space-y-3">{items.map(({ project, period, item }) => <Link key={item.id} href={`/projects/${project.id}/compliance?period=${period.id}`} className="card flex flex-wrap items-center justify-between gap-3 transition hover:border-brand-400/40">
      <div className="min-w-0"><div className="font-semibold">{item.title}</div><div className="text-xs text-slate-500">{project.title}{item.description ? ` · ${item.description}` : ""}</div></div>
      <div className="flex gap-2"><Badge tone={severityTone(item.severity)}>{SEVERITY_LABEL[item.severity] ?? item.severity}</Badge><Badge tone={checklistStatusTone(item.status)}>{CHECKLIST_STATUS_LABEL[item.status] ?? item.status.replace(/_/g, " ")}</Badge></div>
    </Link>)}</div>}
  </div>;
}
