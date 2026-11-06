import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { ProjectsResponseSchema } from "@/lib/server/schemas";
import { DashboardListSchema } from "@/lib/server/schemas-dashboards";
import { CanvasListSchema } from "@/lib/server/schemas-canvas";
import { InlineError } from "@/components/feedback/PageState";
import { z } from "zod";
import { OpenAsCanvasButton } from "@/features/canvas/presentation/OpenAsCanvasButton";

export const dynamic = "force-dynamic";

const InfographicListSchema = z.object({ items: z.array(z.object({ id: z.string(), title: z.string() }).passthrough()) });
const SCOPE = { ORG: "Whole organisation", PROJECT: "One project", MINE: "Only me", PORTFOLIO: "Portfolio" } as const;
const MAX_PROJECTS_SCANNED = 25;

/** Dashboards and infographics in one place: the canvases, and the older dashboards and designs that have not been opened as a canvas yet (opening one keeps the original). */
export default async function VisualsPage() {
  const ctx = await requireSession();
  const [canvases, dashboards, projects] = await Promise.all([
    gatewayRequest("/v1/canvases", CanvasListSchema, ctx.token),
    gatewayRequest("/v1/dashboards", DashboardListSchema, ctx.token),
    gatewayRequest("/v1/projects", ProjectsResponseSchema, ctx.token),
  ]);
  if (!canvases.ok) return <InlineError title={canvases.error.message} referenceId={canvases.error.referenceId} />;
  const projectItems = projects.ok ? projects.value.items : [];
  const names = new Map(projectItems.map((p) => [p.id, p.title]));
  const designs = await Promise.all(projectItems.slice(0, MAX_PROJECTS_SCANNED).map(async (p) => {
    const r = await gatewayRequest(`/v1/projects/${encodeURIComponent(p.id)}/infographics`, InfographicListSchema, ctx.token);
    return (r.ok ? r.value.items : []).map((d) => ({ id: d.id, title: d.title, projectId: p.id }));
  }));
  const opened = new Set(canvases.value.map((c) => `${c.sourceKind ?? ""}:${(c as { sourceId?: string }).sourceId ?? ""}`));
  const olderDashboards = (dashboards.ok ? dashboards.value.dashboards : []).filter((d) => !opened.has(`DASHBOARD:${d.id}`));
  const olderDesigns = designs.flat().filter((d) => !opened.has(`INFOGRAPHIC:${d.id}`));

  return (
    <div className="animate-fade-in space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Dashboards and infographics</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">One kind of page for both. Open it live to watch the figures, or finish it and share it as an infographic. It stores which blocks you chose and where they sit, never the figures: they are read from the project&apos;s records each time.</p>
        </div>
        <a className="rounded bg-sky-700 px-3 py-2 text-sm font-medium text-white hover:bg-sky-800" href="/visuals/new">New</a>
      </header>

      <section aria-label="Your canvases">
        {canvases.value.length === 0 ? <p className="text-sm text-slate-500">Nothing here yet. Start from a template, or open one of the older pages below.</p> : (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-700" data-testid="canvas-list">
            {canvases.value.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <div><a className="font-medium hover:underline" href={`/visuals/${c.id}`}>{c.title}</a>
                  <p className="text-xs text-slate-500">{SCOPE[c.scope]}{c.projectId && names.get(c.projectId) ? ` · ${names.get(c.projectId)}` : ""} · {c.mode === "LIVE" ? "Live" : "To share"} · {c.blockCount} block{c.blockCount === 1 ? "" : "s"}{c.pageCount > 1 ? ` · ${c.pageCount} pages` : ""}</p></div>
                <span className="text-xs text-slate-500">{c.mine ? "Made by you" : ""}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {(olderDashboards.length > 0 || olderDesigns.length > 0) && (
        <section aria-label="Older pages" className="space-y-2">
          <h2 className="text-sm font-semibold">Older dashboards and designs</h2>
          <p className="text-xs text-slate-500">Open one here to edit it with the new tools. The original stays where it was.</p>
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-700" data-testid="older-list">
            {olderDashboards.map((d) => <li key={`d${d.id}`} className="flex flex-wrap items-center justify-between gap-2 p-3"><div><span className="font-medium">{d.name}</span><p className="text-xs text-slate-500">Dashboard · {SCOPE[d.scope]} · {d.chartCount} chart{d.chartCount === 1 ? "" : "s"}</p></div><span className="flex gap-3 text-sm"><OpenAsCanvasButton kind="dashboard" sourceId={d.id} /><a className="text-slate-500 underline" href={`/dashboards/${d.id}`}>Open the original</a></span></li>)}
            {olderDesigns.map((d) => <li key={`i${d.id}`} className="flex flex-wrap items-center justify-between gap-2 p-3"><div><span className="font-medium">{d.title}</span><p className="text-xs text-slate-500">Infographic · {names.get(d.projectId) ?? "A project"}</p></div><span className="flex gap-3 text-sm"><OpenAsCanvasButton kind="infographic" sourceId={d.id} /><a className="text-slate-500 underline" href={`/projects/${d.projectId}/infographics/${d.id}`}>Open the original</a></span></li>)}
          </ul>
        </section>
      )}
    </div>
  );
}
