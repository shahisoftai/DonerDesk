import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { requireSession } from "@/lib/server/auth-context";
import { getProject } from "@/lib/server/project-queries";
import { ProjectCrumbs, ProjectNav } from "@/features/projects/presentation/ProjectNav";
import type { ProjectFact } from "@/features/projects/domain/project-tabs";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { CollectionFormListSchema } from "@/lib/server/schemas-collection";
import { listDatasetsAction } from "@/lib/actions/datasets";
import { InlineError } from "@/components/feedback/PageState";
import { RecordButton } from "@/features/record/presentation/RecordButton";
import { canReachProjectPage, landingPageFor } from "@/features/projects/domain/role-project-pages";
import { availableKinds } from "@/features/record/domain/record-kinds";
import { ProjectLifecycleBanner } from "@/features/projects/presentation/ProjectLifecycleBanner";
import { formatDate } from "@/lib/shared/dates";
import { loadReportingProfileAction } from "@/lib/actions/setup";
import { FrameworkVocabularyProvider } from "@/features/logframe/presentation/FrameworkVocabularyProvider";

export const dynamic = "force-dynamic";

export default async function ProjectLayout({ params, children }: { params: Promise<{ id: string }>; children: ReactNode }) {
  const resolvedParams = await params;
  const ctx = await requireSession();
  const projectResult = await getProject(ctx.token, resolvedParams.id);

  if (!projectResult.ok) {
    if (projectResult.error.kind === "not_found") notFound();
    return <InlineError title={projectResult.error.message} referenceId={projectResult.error.referenceId} />;
  }
  const project = projectResult.value;
  // A failed read shows the default words; the project still opens.
  const [profile, datasets, forms] = await Promise.all([
    loadReportingProfileAction(project.id),
    // A role that cannot open the datasets page does not ask for them (the project bar only needs to know whether there are any).
    canReachProjectPage(ctx.role, "/datasets") ? listDatasetsAction(project.id) : Promise.resolve({ ok: false as const }),
    gatewayRequest(`/v1/projects/${encodeURIComponent(project.id)}/collection-forms`, CollectionFormListSchema, ctx.token),
  ]);
  // A role restricted to a few pages (the field officer) gets "not found" for any other page, wherever the link came from; the project's front
  // page sends them to their own work instead (Phase 63).
  const requested = ((await headers()).get("x-pathname") ?? "").split("?", 1)[0] ?? "";
  const base = `/projects/${project.id}`;
  if (requested.startsWith(base) && !canReachProjectPage(ctx.role, requested.slice(base.length))) {
    const landing = requested.slice(base.length).replace(/\/+$/, "") === "" ? landingPageFor(ctx.role, forms.ok && forms.value.forms.length > 0) : null;
    if (landing) redirect(base + landing);
    notFound();
  }
  // Rare tools stay under "More" until the project uses them (plan F5); a failed read only folds them.
  const facts: ProjectFact[] = [
    ...(datasets.ok && datasets.value.datasets.length > 0 ? (["DATASETS"] as const) : []),
    ...(forms.ok && forms.value.forms.length > 0 ? (["FORMS"] as const) : []),
  ];
  const vocabulary = profile.ok ? profile.value.profile?.vocabulary : undefined;

  return (
    <div className="mx-auto w-full max-w-[1280px]">
      <header className="space-y-4">
        <div>
          <ProjectCrumbs projectId={project.id} projectTitle={project.title} />
          <div className="flex items-start justify-between gap-x-6 gap-y-3 max-sm:flex-wrap">
            <div className="min-w-0 flex-1">
              {/* On a phone the header must not push the page's first field below the fold: two title lines, one meta line (Phase 44). */}
              <h1 className="line-clamp-2 text-[22px] font-semibold leading-tight tracking-[-0.02em] text-slate-950 sm:line-clamp-none dark:text-white">{project.title}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-slate-500 dark:text-slate-400">
                <span className="tag tag-blue">{project.status.replace(/_/g, " ").toLowerCase()}</span>
                <span className="font-mono text-xs">{project.projectCode}</span>
                <span className="hidden sm:inline">{project.donorName}</span>
                <span>{project.country}</span>
                <span className="hidden sm:inline">{project.sector}</span>
                <span className="hidden md:inline">{formatDate(project.startDate)} – {formatDate(project.endDate)} · {project.reportingFrequency.replace(/_/g, " ").toLowerCase()} reporting</span>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {availableKinds({ has: (c) => ctx.capabilities.has(c), hasForms: forms.ok && forms.value.forms.length > 0 }).length > 0 && <RecordButton projectId={project.id} />}
            </div>
          </div>
        </div>
        <ProjectLifecycleBanner projectId={project.id} status={project.status} canEdit={ctx.capabilities.has("project.edit")} />
        <ProjectNav projectId={project.id} facts={facts} capabilities={[...ctx.capabilities]} role={ctx.role} />
      </header>
      <div className="mt-8"><FrameworkVocabularyProvider vocabulary={vocabulary}>{children}</FrameworkVocabularyProvider></div>
    </div>
  );
}
