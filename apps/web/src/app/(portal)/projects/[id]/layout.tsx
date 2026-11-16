import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/server/auth-context";
import { getProject } from "@/lib/server/project-queries";
import { ProjectCrumbs, ProjectNav } from "@/features/projects/presentation/ProjectNav";
import type { ProjectFact } from "@/features/projects/domain/project-tabs";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { CollectionFormListSchema } from "@/lib/server/schemas-collection";
import { listDatasetsAction } from "@/lib/actions/datasets";
import { InlineError } from "@/components/feedback/PageState";
import { RecordButton } from "@/features/record/presentation/RecordButton";
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
    listDatasetsAction(project.id),
    gatewayRequest(`/v1/projects/${encodeURIComponent(project.id)}/collection-forms`, CollectionFormListSchema, ctx.token),
  ]);
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
              {ctx.capabilities.has("indicator.update") && <RecordButton projectId={project.id} />}
            </div>
          </div>
        </div>
        <ProjectLifecycleBanner projectId={project.id} status={project.status} canEdit={ctx.capabilities.has("project.edit")} />
        <ProjectNav projectId={project.id} facts={facts} capabilities={[...ctx.capabilities]} />
      </header>
      <div className="mt-8"><FrameworkVocabularyProvider vocabulary={vocabulary}>{children}</FrameworkVocabularyProvider></div>
    </div>
  );
}
