import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { ProjectsResponseSchema, DataSheetResponseSchema } from "@/lib/server/schemas";
import { CanvasSchema, ResolvedCanvasSchema } from "@/lib/server/schemas-canvas";
import { InlineError } from "@/components/feedback/PageState";
import { CanvasWorkspace } from "@/features/canvas/presentation/CanvasWorkspace";
import { projectOf } from "@donordesk/domain/contexts/canvas/index.js";

export const dynamic = "force-dynamic";

const MAX_PROJECTS = 8;

export default async function VisualPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireSession();
  const [canvas, resolved, projects] = await Promise.all([
    gatewayRequest(`/v1/canvases/${encodeURIComponent(id)}`, CanvasSchema, ctx.token),
    gatewayRequest(`/v1/canvases/${encodeURIComponent(id)}/resolve`, ResolvedCanvasSchema, ctx.token),
    gatewayRequest("/v1/projects", ProjectsResponseSchema, ctx.token),
  ]);
  if (!canvas.ok) return <InlineError title={canvas.error.message} referenceId={canvas.error.referenceId} />;
  const projectList = (projects.ok ? projects.value.items : []).map((p) => ({ id: p.id, name: p.title }));
  // The indicators each block's project offers, for the pickers: the canvas's own project and the ones its blocks name.
  const wanted = new Set<string>(canvas.value.projectId ? [canvas.value.projectId] : []);
  for (const page of canvas.value.canvas.pages) for (const b of page.blocks) { const p = projectOf(b.bindings); if (p) wanted.add(p); }
  const pickers = [...wanted].slice(0, MAX_PROJECTS);
  const sheets = await Promise.all(pickers.map((pid) => gatewayRequest(`/v1/projects/${encodeURIComponent(pid)}/data-sheet`, DataSheetResponseSchema, ctx.token)));
  const indicatorsByProject = Object.fromEntries(pickers.map((pid, i) => [pid, (sheets[i]!.ok ? sheets[i]!.value.indicators : []).map((x) => ({ id: x.id, code: x.code, name: x.name }))]));
  return (
    <div className="animate-fade-in space-y-3">
      <p className="text-xs print:hidden"><a className="hover:underline" href="/visuals">Dashboards and infographics</a></p>
      <CanvasWorkspace initial={canvas.value} resolved={resolved.ok ? resolved.value : null} resolveError={resolved.ok ? null : resolved.error.message} projects={projectList} indicatorsByProject={indicatorsByProject} />
    </div>
  );
}
