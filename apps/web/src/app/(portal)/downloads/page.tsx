import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { ExportsResponseSchema, ProjectsResponseSchema, ReportingPeriodsResponseSchema } from "@/lib/server/schemas";
import { InlineError, EmptyState } from "@/components/feedback/PageState";
import { EXPORT_TYPE_LABEL, REPORT_TYPE_LABEL } from "@/lib/labels";
import { DownloadCenter, type DownloadRow } from "@/features/reports/presentation/DownloadCenter";
import { formatDateTime } from "@/lib/shared/dates";
import { protectedFileDownloadHref } from "@/lib/shared/downloads";

export const dynamic = "force-dynamic";

export default async function DownloadCenterPage() {
  const ctx = await requireSession();
  const projectsResult = await gatewayRequest("/v1/projects", ProjectsResponseSchema, ctx.token);
  if (!projectsResult.ok) return <InlineError title={projectsResult.error.message} referenceId={projectsResult.error.referenceId} />;
  const perProject = await Promise.all(projectsResult.value.items.map(async (project) => {
    const exp = await gatewayRequest(`/v1/projects/${project.id}/exports`, ExportsResponseSchema, ctx.token);
    // Periods are only needed to label the report link; fetch them only for projects that have exports.
    const per = exp.ok && exp.value.items.length > 0 ? await gatewayRequest(`/v1/projects/${project.id}/reporting-periods`, ReportingPeriodsResponseSchema, ctx.token) : null;
    return { project, exp, per };
  }));
  const failed = perProject.filter((p) => !p.exp.ok).length;
  const rows: DownloadRow[] = perProject.flatMap(({ project, exp, per }) => {
    if (!exp.ok) return [];
    const periods = new Map((per?.ok ? per.value.items : []).map((p) => [p.id, p]));
    return exp.value.items.map((e) => {
      const period = e.reportingPeriodId ? periods.get(e.reportingPeriodId) : undefined;
      const typeLabel = EXPORT_TYPE_LABEL[e.exportType] ?? e.exportType.replace(/_/g, " ");
      return {
        id: e.id, projectId: project.id, projectTitle: project.title, title: e.fileName ?? `${project.title} · ${typeLabel}`,
        typeKey: e.exportType, typeLabel, version: e.version, createdAt: e.createdAt, createdLabel: formatDateTime(e.createdAt),
        href: protectedFileDownloadHref(e.fileUrl, e.fileName),
        ...(period ? { reportLabel: REPORT_TYPE_LABEL[period.reportType] ?? "Report", reportHref: `/projects/${project.id}/reports/${period.id}` } : {}),
      };
    });
  });

  return <div className="animate-fade-in">
    <header><p className="text-[10px] font-medium uppercase tracking-[0.12em] text-brand-600 dark:text-brand-400">All projects</p><h1 className="mt-1 text-xl font-semibold tracking-tight">Download Center</h1><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Every report and file you have exported.</p></header>
    {failed > 0 && <div className="mt-5"><InlineError title={`${failed} project export ${failed === 1 ? "list is" : "lists are"} temporarily unavailable.`} /></div>}
    {rows.length === 0 ? <div className="mt-6"><EmptyState>Nothing has been exported yet. Export a report from its page and it will appear here.</EmptyState></div> : <DownloadCenter rows={rows} />}
  </div>;
}
