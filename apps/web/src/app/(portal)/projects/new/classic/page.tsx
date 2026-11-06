import Link from "next/link";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { OrganizationProfileSchema, ProjectsResponseSchema } from "@/lib/server/schemas";
import { NewProjectWizard } from "@/features/projects/presentation/NewProjectWizard";
import { projectWizardDefaults } from "@/features/projects/domain/project-wizard-defaults";

export const dynamic = "force-dynamic";

export default async function NewProjectPage() {
  const ctx = await requireSession();
  const [orgResult, projectsResult] = await Promise.all([
    gatewayRequest("/v1/organization", OrganizationProfileSchema, ctx.token),
    gatewayRequest("/v1/projects", ProjectsResponseSchema, ctx.token),
  ]);
  // Defaults are a convenience: if either lookup fails the form simply starts empty.
  const org = orgResult.ok ? orgResult.value : { name: "", country: "", sectors: [] };
  const projects = (projectsResult.ok ? projectsResult.value.items : []).filter((p) => !p.isDemo);
  const { data, suggestions } = projectWizardDefaults({ organization: org, projects });
  return (
    <>
    <p className="mx-auto flex max-w-3xl flex-wrap gap-x-6 gap-y-1 px-6 pt-6 text-sm">
      {/* A plain anchor: the wizard starts a new draft on the server, so the page must load fresh. */}
      <a href="/projects/new" className="font-medium underline">Back to the guided setup</a>
      <Link href="/projects/new/document" className="underline">Set up from a project document instead</Link>
    </p>
    <NewProjectWizard
      defaults={data}
      suggestions={suggestions}
      startFrom={projects.map((p) => ({ id: p.id, title: p.title, project: p }))}
    />
    </>
  );
}
