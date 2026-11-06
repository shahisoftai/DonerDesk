import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { ProjectsResponseSchema } from "@/lib/server/schemas";
import { NewVisualForm } from "@/features/canvas/presentation/NewVisualForm";

export const dynamic = "force-dynamic";

export default async function NewVisualPage() {
  const ctx = await requireSession();
  const projects = await gatewayRequest("/v1/projects", ProjectsResponseSchema, ctx.token);
  return (
    <div className="animate-fade-in space-y-4">
      <p className="text-xs"><a className="hover:underline" href="/visuals">Dashboards and infographics</a></p>
      <h1 className="text-xl font-semibold tracking-tight">New dashboard or infographic</h1>
      <NewVisualForm canShare={ctx.capabilities.has("project.edit")} projects={(projects.ok ? projects.value.items : []).map((p) => ({ id: p.id, name: p.title }))} />
    </div>
  );
}
