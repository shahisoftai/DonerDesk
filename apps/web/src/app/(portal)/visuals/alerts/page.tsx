import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { DataSheetResponseSchema, ProjectsResponseSchema } from "@/lib/server/schemas";
import { DataAlertListSchema } from "@/lib/server/schemas-visual-data";
import { InlineError } from "@/components/feedback/PageState";
import { ShellTabs } from "@/features/visual-studio/presentation/ShellTabs";
import { ProjectFilter } from "@/features/visual-studio/presentation/ProjectFilter";
import { AlertsPanel } from "@/features/visual-studio/presentation/AlertsPanel";

export const dynamic = "force-dynamic";

/** Threshold alerts: a rule on one indicator that tells the person once when the figure crosses (evaluated every hour). */
export default async function VisualAlertsPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const { project } = await searchParams;
  const ctx = await requireSession();
  const [projects, alerts, sheet] = await Promise.all([
    gatewayRequest("/v1/projects", ProjectsResponseSchema, ctx.token),
    gatewayRequest("/v1/visual-data/alerts", DataAlertListSchema, ctx.token),
    project ? gatewayRequest(`/v1/projects/${encodeURIComponent(project)}/data-sheet`, DataSheetResponseSchema, ctx.token) : Promise.resolve(null),
  ]);
  if (!alerts.ok) return <InlineError title={alerts.error.message} referenceId={alerts.error.referenceId} />;
  const items = projects.ok ? projects.value.items : [];
  return (
    <div className="page-stack animate-fade-in">
      <h1 className="page-title">Visual Studio</h1>
      <ShellTabs active="alerts" />
      <p className="max-w-3xl text-sm text-slate-500">An alert watches one figure. You are told once when it crosses your rule, and again only after it has recovered and crossed again.</p>
      <ProjectFilter projects={items} selected={project} action="/visuals/alerts" />
      <AlertsPanel projectId={project} indicators={sheet && sheet.ok ? sheet.value.indicators.map((i) => ({ id: i.id, code: i.code, name: i.name })) : []}
        alerts={alerts.value.alerts} projectNames={Object.fromEntries(items.map((p) => [p.id, p.title]))} />
    </div>
  );
}
