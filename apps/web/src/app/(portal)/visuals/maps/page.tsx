import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { ProjectsResponseSchema } from "@/lib/server/schemas";
import { InlineError } from "@/components/feedback/PageState";
import { ShellTabs } from "@/features/visual-studio/presentation/ShellTabs";

export const dynamic = "force-dynamic";

/** Results by place for each project, through the Maps page every project already has. */
export default async function VisualMapsPage() {
  const ctx = await requireSession();
  const projects = await gatewayRequest("/v1/projects", ProjectsResponseSchema, ctx.token);
  if (!projects.ok) return <InlineError title={projects.error.message} referenceId={projects.error.referenceId} />;
  return (
    <div className="animate-fade-in space-y-4">
      <h1 className="text-xl font-semibold tracking-tight">Visual Studio</h1>
      <ShellTabs active="maps" />
      <p className="max-w-3xl text-sm text-slate-500">A map reads one project&apos;s results by place. Choose a project to open its map, or add a map block to a design from Designs.</p>
      <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-700" data-testid="map-list">
        {projects.value.items.map((p) => <li key={p.id} className="flex items-center justify-between p-3"><span className="font-medium">{p.title}</span><a className="text-sm underline" href={`/projects/${p.id}/maps`}>Open the map</a></li>)}
      </ul>
    </div>
  );
}
