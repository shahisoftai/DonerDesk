import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/server/auth-context";
import { getProject } from "@/lib/server/project-queries";
import { Breadcrumbs } from "@/components/data/Breadcrumbs";
import { Tabs } from "@/components/data/Tabs";
import { InlineError } from "@/components/feedback/PageState";

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
    { label: "Overview", href: `/projects/${project.id}` },
    { label: "Templates", href: `/projects/${project.id}/templates` },
    { label: "Logframe", href: `/projects/${project.id}/logframe` },
    { label: "Activities", href: `/projects/${project.id}/activities` },
    { label: "Evidence", href: `/projects/${project.id}/evidence` },
    { label: "Reports", href: `/projects/${project.id}/reports` },
    { label: "Compliance", href: `/projects/${project.id}/compliance` },
  ];

  return (
    <div>
      <Breadcrumbs items={[{ label: "Projects", href: "/projects" }, { label: project.title }]} />
      <h1 className="mt-2 text-2xl font-bold">{project.title}</h1>
      <div className="mt-4">
        <Tabs items={tabs} label="Project sections" />
      </div>
      <div className="mt-6">{children}</div>
    </div>
  );
}
