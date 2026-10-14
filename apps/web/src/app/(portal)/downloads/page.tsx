import Link from "next/link";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { ExportsResponseSchema, ProjectsResponseSchema, ReportingPeriodsResponseSchema } from "@/lib/server/schemas";
import { InlineError, EmptyState } from "@/components/feedback/PageState";
import { EXPORT_TYPE_LABEL, REPORT_TYPE_LABEL } from "@/lib/labels";
import { formatDateTime } from "@/lib/shared/dates";
import { protectedFileDownloadHref } from "@/lib/shared/downloads";

export const dynamic = "force-dynamic";

export default async function DownloadCenterPage({ searchParams }: { searchParams: Promise<{ type?: string; project?: string }> }) {
  const { type, project: projectFilter } = await searchParams;
  const ctx = await requireSession();
  const projectsResult = await gatewayRequest("/v1/projects", ProjectsResponseSchema, ctx.token);
  if (!projectsResult.ok) return <InlineError title={projectsResult.error.message} referenceId={projectsResult.error.referenceId} />;
  const perProject = await Promise.all(projectsResult.value.items.map(async (project) => {
    const [exp, per] = await Promise.all([
      gatewayRequest(`/v1/projects/${project.id}/exports`, ExportsResponseSchema, ctx.token),
      gatewayRequest(`/v1/projects/${project.id}/reporting-periods`, ReportingPeriodsResponseSchema, ctx.token),
    ]);
    return { project, exp, per };
  }));
  const failed = perProject.filter((p) => !p.exp.ok).length;
  const all = perProject.flatMap(({ project, exp, per }) => {
    if (!exp.ok) return [];
    const periods = new Map((per.ok ? per.value.items : []).map((p) => [p.id, p]));
    return exp.value.items.map((e) => ({ project, e, period: e.reportingPeriodId ? periods.get(e.reportingPeriodId) : undefined }));
  }).sort((a, b) => b.e.createdAt.localeCompare(a.e.createdAt));
  const types = [...new Set(all.map((x) => x.e.exportType))];
  const rows = all.filter((x) => (!type || x.e.exportType === type) && (!projectFilter || x.project.id === projectFilter));
  const href = (t?: string, p?: string) => { const q = new URLSearchParams(); if (t) q.set("type", t); if (p) q.set("project", p); const s = q.toString(); return s ? `/downloads?${s}` : "/downloads"; };
  const chip = (active: boolean) => `rounded-full border px-3 py-1.5 text-xs font-medium transition ${active ? "border-brand-500 bg-brand-500/10 text-brand-700 dark:text-brand-300" : "border-slate-300 text-slate-600 hover:border-brand-400/50 dark:border-white/10 dark:text-slate-300"}`;

  return <div className="animate-fade-in">
    <header><p className="text-[10px] font-medium uppercase tracking-[0.12em] text-brand-600 dark:text-brand-400">All projects</p><h1 className="mt-1 text-xl font-semibold tracking-tight">Download Center</h1><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Every report and file you have exported, newest first.</p></header>
    {failed > 0 && <div className="mt-5"><InlineError title={`${failed} project export ${failed === 1 ? "list is" : "lists are"} temporarily unavailable.`} /></div>}
    {all.length === 0 ? <div className="mt-6"><EmptyState>Nothing has been exported yet. Export a report from its page and it will appear here.</EmptyState></div> : <>
      <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Filter downloads">
        <Link href={href(undefined, projectFilter)} className={chip(!type)}>All types</Link>
        {types.map((t) => <Link key={t} href={href(t, projectFilter)} className={chip(type === t)}>{EXPORT_TYPE_LABEL[t] ?? t.replace(/_/g, " ")}</Link>)}
      </div>
      <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Filter by project">
        <Link href={href(type)} className={chip(!projectFilter)}>All projects</Link>
        {projectsResult.value.items.filter((p) => all.some((x) => x.project.id === p.id)).map((p) => <Link key={p.id} href={href(type, p.id)} className={chip(projectFilter === p.id)}>{p.title}</Link>)}
      </div>
      {rows.length === 0 ? <p className="mt-6 text-sm text-slate-500">No downloads match these filters.</p> : <ul className="mt-6 space-y-3">{rows.map(({ project, e, period }) => <li key={e.id} className="card flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium">{e.fileName ?? `${project.title} · ${EXPORT_TYPE_LABEL[e.exportType] ?? e.exportType}`}</div>
          <div className="text-xs text-slate-500">{project.title} · {EXPORT_TYPE_LABEL[e.exportType] ?? e.exportType.replace(/_/g, " ")}{period ? <> · <Link className="hover:underline" href={`/projects/${project.id}/reports/${period.id}`}>{REPORT_TYPE_LABEL[period.reportType] ?? "Report"}</Link></> : null} · Version {e.version ?? "—"} · {formatDateTime(e.createdAt)}</div>
        </div>
        <a className="btn-secondary py-1 text-xs" href={protectedFileDownloadHref(e.fileUrl, e.fileName)}>Download</a>
      </li>)}</ul>}
    </>}
  </div>;
}
