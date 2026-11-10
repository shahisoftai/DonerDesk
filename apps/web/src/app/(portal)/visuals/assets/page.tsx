import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { ProjectsResponseSchema } from "@/lib/server/schemas";
import { InlineError } from "@/components/feedback/PageState";
import { ShellTabs } from "@/features/visual-studio/presentation/ShellTabs";
import { ProjectFilter } from "@/features/visual-studio/presentation/ProjectFilter";
import { InfographicsList } from "@/features/infographics/presentation/InfographicsList";

export const dynamic = "force-dynamic";

/** The image library, the brand kit and saved layouts, for one project or for the portfolio (the library that older infographic designs kept). */
export default async function VisualAssetsPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const { project } = await searchParams;
  const ctx = await requireSession();
  const projects = await gatewayRequest("/v1/projects", ProjectsResponseSchema, ctx.token);
  if (!projects.ok) return <InlineError title={projects.error.message} referenceId={projects.error.referenceId} />;
  const items = [{ id: "portfolio", title: "Whole portfolio" }, ...projects.value.items.map((p) => ({ id: p.id, title: p.title }))];
  const portfolio = project === "portfolio";
  return (
    <div className="animate-fade-in space-y-4">
      <h1 className="text-xl font-semibold tracking-tight">Visual Studio</h1>
      <ShellTabs active="assets" />
      <ProjectFilter projects={items} selected={project} action="/visuals/assets" />
      {!project
        ? <p className="text-sm text-slate-500">Choose a project, or the whole portfolio, to see its images, brand kit and saved layouts.</p>
        : <InfographicsList projectId={project} scope={portfolio ? "PORTFOLIO" : "PROJECT"} canEdit={ctx.capabilities.has("reporting.edit")} canExport={ctx.capabilities.has("export.create")} canManageBrand={ctx.capabilities.has("org.manage")} />}
    </div>
  );
}
