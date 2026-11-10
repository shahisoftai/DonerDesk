import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { ProjectsResponseSchema } from "@/lib/server/schemas";
import { SavedChartListSchema } from "@/lib/server/schemas-charts";
import { InlineError } from "@/components/feedback/PageState";
import { ShellTabs } from "@/features/visual-studio/presentation/ShellTabs";
import { ProjectFilter } from "@/features/visual-studio/presentation/ProjectFilter";

export const dynamic = "force-dynamic";
const MAX_PROJECTS_SCANNED = 25;

/** Every saved chart across the projects the person can see, with a way into the Chart Studio of each (the Studio itself is unchanged). */
export default async function VisualChartsPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const { project } = await searchParams;
  const ctx = await requireSession();
  const projects = await gatewayRequest("/v1/projects", ProjectsResponseSchema, ctx.token);
  const items = projects.ok ? projects.value.items : [];
  // The api lists charts one project at a time, so "All projects" asks for each (the first MAX_PROJECTS_SCANNED).
  const scanned = project ? items.filter((p) => p.id === project) : items.slice(0, MAX_PROJECTS_SCANNED);
  const lists = await Promise.all(scanned.map((p) => gatewayRequest(`/v1/charts?projectId=${encodeURIComponent(p.id)}`, SavedChartListSchema, ctx.token)));
  const failed = lists.find((l) => !l.ok);
  if (failed && !failed.ok) return <InlineError title={failed.error.message} referenceId={failed.error.referenceId} />;
  const charts = { value: { charts: lists.flatMap((l) => (l.ok ? l.value.charts : [])) } };
  const names = new Map(items.map((p) => [p.id, p.title]));
  return (
    <div className="animate-fade-in space-y-4">
      <h1 className="text-xl font-semibold tracking-tight">Visual Studio</h1>
      <ShellTabs active="charts" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ProjectFilter projects={items} selected={project} action="/visuals/charts" />
        {project && <a className="rounded bg-sky-700 px-3 py-2 text-sm font-medium text-white hover:bg-sky-800" href={`/projects/${project}/charts`}>New chart in this project</a>}
      </div>
      {!project && <p className="text-sm text-slate-500">Choose a project to start a new chart. A chart is drawn from that project&apos;s records.</p>}
      {charts.value.charts.length === 0 ? <p className="text-sm text-slate-500">No saved charts{project ? " in this project" : ""} yet.</p> : (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-700" data-testid="chart-list">
          {charts.value.charts.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
              <div><a className="font-medium hover:underline" href={`/projects/${c.projectId}/charts`}>{c.name}</a>
                <p className="text-xs text-slate-500">{names.get(c.projectId) ?? "A project"} · {c.scope === "MINE" ? "Only me" : "Shared in the project"}</p></div>
              <span className="text-xs text-slate-500">{c.mine ? "Made by you" : ""}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
