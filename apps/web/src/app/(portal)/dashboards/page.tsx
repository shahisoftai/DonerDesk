import Link from "next/link";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { ProjectsResponseSchema } from "@/lib/server/schemas";
import { DashboardListSchema } from "@/lib/server/schemas-dashboards";
import { InlineError } from "@/components/feedback/PageState";
import { NewDashboardForm } from "@/features/dashboards/presentation/NewDashboardForm";

export const dynamic = "force-dynamic";

const SCOPE = { ORG: "Whole organisation", PROJECT: "One project", MINE: "Only me" } as const;

/** Dashboards: pages of Data Center charts the team keeps. Yours, the organisation's, and (when a project is chosen) the project's. */
export default async function DashboardsPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const { project } = await searchParams;
  const ctx = await requireSession();
  const [list, projects] = await Promise.all([
    gatewayRequest(`/v1/dashboards${project ? `?projectId=${encodeURIComponent(project)}` : ""}`, DashboardListSchema, ctx.token),
    gatewayRequest("/v1/projects", ProjectsResponseSchema, ctx.token),
  ]);
  if (!list.ok) return <InlineError title={list.error.message} referenceId={list.error.referenceId} />;
  const names = new Map((projects.ok ? projects.value.items : []).map((p) => [p.id, p.title]));
  return (
    <div className="animate-fade-in space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Dashboards</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-500">Keep the charts you look at often in one place. A dashboard stores which chart and where it sits, never the figures: each chart is drawn from the project&apos;s recorded values when you open it.</p>
      </header>
      <section className="card"><NewDashboardForm canShare={ctx.capabilities.has("project.edit")} projects={(projects.ok ? projects.value.items : []).map((p) => ({ id: p.id, name: p.title }))} {...(project ? { projectId: project } : {})} /></section>
      {list.value.dashboards.length === 0 ? <p className="text-sm text-slate-500">No dashboards yet.</p> : (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
          {list.value.dashboards.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
              <div>
                <Link className="font-medium hover:underline" href={`/dashboards/${d.id}`}>{d.name}</Link>
                <p className="text-xs text-slate-500">{SCOPE[d.scope]}{d.projectId && names.get(d.projectId) ? ` · ${names.get(d.projectId)}` : ""} · {d.chartCount} chart{d.chartCount === 1 ? "" : "s"}</p>
              </div>
              <span className="text-xs text-slate-500">{d.mine ? "Made by you" : ""}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
