import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { ProjectsResponseSchema } from "@/lib/server/schemas";
import { ShellTabs } from "@/features/visual-studio/presentation/ShellTabs";
import { UploadWizard } from "@/features/datasets/presentation/UploadWizard";
import { getDatasetAction, listDatasetKitsAction } from "@/lib/actions/datasets";

export const dynamic = "force-dynamic";

/** Bring in a table (§4.2), or add new data to an existing dataset (`?refresh=<id>`). */
export default async function NewDatasetPage({ searchParams }: { searchParams: Promise<{ projectId?: string; refresh?: string }> }) {
  const { projectId, refresh } = await searchParams;
  const ctx = await requireSession();
  const [projects, kits, existing] = await Promise.all([gatewayRequest("/v1/projects", ProjectsResponseSchema, ctx.token), listDatasetKitsAction(), refresh ? getDatasetAction(refresh) : Promise.resolve(null)]);
  const items = projects.ok ? projects.value.items.map((p) => ({ id: p.id, title: p.title, country: p.country })) : [];
  const target = existing && existing.ok ? existing.value : undefined;
  return (
    <div className="page-stack animate-fade-in">
      <h1 className="page-title">Visual Studio</h1>
      <ShellTabs active="datasets" />
      <h2 className="section-title">{target ? `Add data to ${target.name}` : "Bring in a table"}</h2>
      <UploadWizard projects={target?.projectId ? items.filter((p) => p.id === target.projectId) : items} kits={kits.ok ? kits.value.kits : []} projectId={projectId ?? target?.projectId}
        canCreateOrg={ctx.capabilities.has("org.manage")} {...(target ? { refresh: { datasetId: target.id, name: target.name } } : {})} />
    </div>
  );
}
