import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { ProjectsResponseSchema } from "@/lib/server/schemas";
import { TemplateListSchema } from "@/lib/server/schemas-dashboards";
import { InlineError } from "@/components/feedback/PageState";
import { ShellTabs } from "@/features/visual-studio/presentation/ShellTabs";
import { TemplateGallery } from "@/features/dashboards/presentation/TemplateGallery";

export const dynamic = "force-dynamic";

/** Where to start: a blank design or a starter, and a draft dashboard for each sector that the organisation copies and edits. */
export default async function VisualTemplatesPage() {
  const ctx = await requireSession();
  const [list, projects] = await Promise.all([
    gatewayRequest("/v1/dashboard-templates", TemplateListSchema, ctx.token),
    gatewayRequest("/v1/projects", ProjectsResponseSchema, ctx.token),
  ]);
  return (
    <div className="page-stack animate-fade-in">
      <h1 className="page-title">Visual Studio</h1>
      <ShellTabs active="templates" />
      <ul className="grid gap-3 sm:grid-cols-2">
        <li className="rounded-lg border border-slate-200 p-4 dark:border-slate-700"><a className="font-medium hover:underline" href="/visuals/new">A new design</a><p className="mt-1 text-sm text-slate-500">Start from a blank page or one of the starters (flash update, results at a glance, funding and burn and others).</p></li>
        <li className="rounded-lg border border-slate-200 p-4 dark:border-slate-700"><a className="font-medium hover:underline" href="#sector-templates">Sector templates</a><p className="mt-1 text-sm text-slate-500">Dashboards for education, health, water and other sectors, with your own copies.</p></li>
      </ul>
      <section id="sector-templates" aria-label="Sector templates" className="space-y-3">
        <h2 className="section-title">Sector templates</h2>
        <p className="max-w-3xl text-sm text-slate-500">A starting point for each sector. Every template is a draft: copy it, change it, and use your copy. A template names what to show (&ldquo;people with basic water access&rdquo;); you choose which of the project&apos;s indicators answers each one.</p>
        {list.ok
          ? <TemplateGallery templates={list.value.templates} projects={(projects.ok ? projects.value.items : []).map((p) => ({ id: p.id, name: p.title }))} canEdit={ctx.capabilities.has("project.edit")} />
          : <InlineError title={list.error.message} referenceId={list.error.referenceId} />}
      </section>
    </div>
  );
}
