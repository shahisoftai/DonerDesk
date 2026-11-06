import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/server/auth-context";
import { getProject } from "@/lib/server/project-queries";
import { Breadcrumbs } from "@/components/data/Breadcrumbs";
import { Tabs } from "@/components/data/Tabs";
import { InlineError } from "@/components/feedback/PageState";
import { RecordButton } from "@/features/record/presentation/RecordButton";
import { ProjectLifecycleBanner } from "@/features/projects/presentation/ProjectLifecycleBanner";
import { formatDate } from "@/lib/shared/dates";

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

  const tabs = [
    // Reporting is the primary surface: each reporting period is a workspace
    // framed as "Update Project → Tell the Story → Generate → Review & Submit".
    { label: "Reporting", href: `/projects/${project.id}/reports` },
    { label: "Overview", href: `/projects/${project.id}` },
    { label: "Logframe", href: `/projects/${project.id}/logframe`, matchPrefixes: [`/projects/${project.id}/indicators`] },
    { label: "Activities", href: `/projects/${project.id}/activities` },
    { label: "Data", href: `/projects/${project.id}/data` },
    { label: "Finance", href: `/projects/${project.id}/finance` },
    { label: "Ask", href: `/projects/${project.id}/ask`, secondary: true },
    { label: "Dashboards", href: `/dashboards?project=${project.id}`, secondary: true },
    { label: "Infographics", href: `/projects/${project.id}/infographics`, secondary: true },
    { label: "Evidence", href: `/projects/${project.id}/evidence`, secondary: true },
    { label: "Bring in data", href: `/projects/${project.id}/import`, secondary: true },
    // One-time setup; placed last so it reads as configuration, not a workflow.
    { label: "Templates", href: `/projects/${project.id}/templates`, secondary: true },
    { label: "Team", href: `/projects/${project.id}/team`, secondary: true },
    { label: "Settings", href: `/projects/${project.id}/settings`, secondary: true },
  ];

  return (
    <div>
      <Breadcrumbs items={[{ label: "Projects", href: "/projects" }, { label: project.title }]} />
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          {/* On a phone the header must not push the page's first field below the fold: two title lines, one meta line (Phase 44). */}
          <h1 className="line-clamp-2 text-lg font-semibold tracking-tight sm:line-clamp-none sm:text-xl">{project.title}</h1>
          <p className="mt-1 truncate text-sm text-slate-500 sm:hidden dark:text-slate-400">
            {project.projectCode} · {project.country}
          </p>
          <p className="mt-1 hidden text-sm text-slate-500 sm:block dark:text-slate-400">
            {project.projectCode} · {project.donorName} · {project.country} · {project.sector}
          </p>
          <p className="mt-1 hidden text-xs text-slate-400 sm:block">
            {formatDate(project.startDate)} – {formatDate(project.endDate)} · {project.reportingFrequency.replace(/_/g, " ").toLowerCase()} reporting
          </p>
        </div>
        <div className="flex items-center gap-2">
          {ctx.capabilities.has("indicator.update") && <RecordButton projectId={project.id} kind="NUMBER" />}
          <span className="tag tag-blue">{project.status.replace(/_/g, " ")}</span>
        </div>
      </div>
      <ProjectLifecycleBanner projectId={project.id} status={project.status} canEdit={ctx.capabilities.has("project.edit")} />
      <div className="mt-4">
        <Tabs items={tabs} label="Project sections" />
      </div>
      <div className="mt-6">{children}</div>
    </div>
  );
}
