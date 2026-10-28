import Link from "next/link";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { ProjectsResponseSchema } from "@/lib/server/schemas";
import { TemplateListSchema } from "@/lib/server/schemas-dashboards";
import { InlineError } from "@/components/feedback/PageState";
import { TemplateGallery } from "@/features/dashboards/presentation/TemplateGallery";

export const dynamic = "force-dynamic";

/** Sector dashboard templates (Phase 34.3): always drafts, always editable by copying; applied to a project by choosing which indicators fill each role. */
export default async function TemplatesPage() {
  const ctx = await requireSession();
  const [list, projects] = await Promise.all([
    gatewayRequest("/v1/dashboard-templates", TemplateListSchema, ctx.token),
    gatewayRequest("/v1/projects", ProjectsResponseSchema, ctx.token),
  ]);
  if (!list.ok) return <InlineError title={list.error.message} referenceId={list.error.referenceId} />;
  return (
    <div className="animate-fade-in space-y-4">
      <p className="text-sm"><Link className="underline" href="/dashboards">Dashboards</Link></p>
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Dashboard templates</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-500">A starting point for each sector. Every template is a draft: copy it, change it, and use your copy. A template names what to show (&ldquo;people with basic water access&rdquo;); you choose which of the project&apos;s indicators answers each one.</p>
      </header>
      <TemplateGallery templates={list.value.templates} projects={(projects.ok ? projects.value.items : []).map((p) => ({ id: p.id, name: p.title }))} canEdit={ctx.capabilities.has("project.edit")} />
    </div>
  );
}
