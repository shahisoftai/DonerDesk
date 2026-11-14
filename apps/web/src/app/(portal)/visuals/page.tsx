import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { ProjectsResponseSchema } from "@/lib/server/schemas";
import { DashboardListSchema } from "@/lib/server/schemas-dashboards";
import { CanvasListSchema } from "@/lib/server/schemas-canvas";
import { InlineError } from "@/components/feedback/PageState";
import { z } from "zod";
import { ShellTabs } from "@/features/visual-studio/presentation/ShellTabs";
import { OpenAsCanvasButton } from "@/features/canvas/presentation/OpenAsCanvasButton";
import { PageHeader, Section } from "@/components/layout/Page";
import { EmptyState } from "@/components/feedback/PageState";
import { LayoutDashboard } from "lucide-react";

export const dynamic = "force-dynamic";

const InfographicListSchema = z.object({ items: z.array(z.object({ id: z.string(), title: z.string() }).passthrough()) });
const SCOPE = { ORG: "Whole organisation", PROJECT: "One project", MINE: "Only me", PORTFOLIO: "Portfolio" } as const;
const MAX_PROJECTS_SCANNED = 25;

/** Dashboards and infographics in one place: the canvases, and the older dashboards and designs that have not been opened as a canvas yet (opening one keeps the original). */
export default async function VisualsPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const { notice } = await searchParams;
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
    <div className="page-stack animate-fade-in">
      {notice && <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-400/10 dark:text-amber-100">{notice.slice(0, 200)}</p>}
      <div>
        <PageHeader
          className="border-b-0 pb-4"
          title="Dashboards and infographics"
          description="One kind of page for both: watch the figures live, or finish it and share it as an infographic. Figures are read from the project's records each time, never stored in the page."
          actions={<><a className="btn-secondary" href="/visuals/templates">Start from a template</a><a className="btn-primary" href="/visuals/new">New design</a></>}
        />
        <ShellTabs active="designs" />
      </div>

      <Section title="Your designs" description="Dashboards and infographics you can open." bare>
        {canvases.value.length === 0 ? (
          <EmptyState icon={<LayoutDashboard />} title="No designs yet" action={<a className="btn-primary" href="/visuals/templates">Start from a template</a>}>
            A template lays out the right charts for your sector. You choose the indicators.
          </EmptyState>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" data-testid="canvas-list">
            {canvases.value.map((c) => (
              <li key={c.id}>
                <a href={`/visuals/${c.id}`} className="group flex h-full flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-card transition hover:-translate-y-px hover:shadow-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-white/10 dark:bg-[#121a2b]">
                  <span className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-slate-900 group-hover:text-brand-700 dark:text-white dark:group-hover:text-brand-300">{c.title}</span>
                    <span className={`tag ${c.mode === "LIVE" ? "tag-green" : "tag-slate"}`}>{c.mode === "LIVE" ? "Live" : "To share"}</span>
                  </span>
                  <span className="mt-auto pt-3 text-xs text-slate-500 dark:text-slate-400">{SCOPE[c.scope]}{c.projectId && names.get(c.projectId) ? ` · ${names.get(c.projectId)}` : ""} · {c.blockCount} block{c.blockCount === 1 ? "" : "s"}{c.pageCount > 1 ? ` · ${c.pageCount} pages` : ""}{c.mine ? " · Made by you" : ""}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {(olderDashboards.length > 0 || olderDesigns.length > 0) && (
        <Section title="Older dashboards and designs" description="Open one here to edit it with the new tools. The original stays where it was.">
          <ul className="divide-y divide-slate-200 dark:divide-white/10" data-testid="older-list">
            {olderDashboards.map((d) => <li key={`d${d.id}`} className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0"><div><span className="font-medium">{d.name}</span><p className="text-xs text-slate-500">Dashboard · {SCOPE[d.scope]} · {d.chartCount} chart{d.chartCount === 1 ? "" : "s"}</p></div><span className="flex gap-3 text-sm"><OpenAsCanvasButton kind="dashboard" sourceId={d.id} /></span></li>)}
            {olderDesigns.map((d) => <li key={`i${d.id}`} className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0"><div><span className="font-medium">{d.title}</span><p className="text-xs text-slate-500">Infographic · {names.get(d.projectId) ?? "A project"}</p></div><span className="flex gap-3 text-sm"><OpenAsCanvasButton kind="infographic" sourceId={d.id} /></span></li>)}
          </ul>
        </Section>
      )}
    </div>
  );
}
