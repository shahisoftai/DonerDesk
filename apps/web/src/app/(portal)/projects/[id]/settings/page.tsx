import { requireSession, hasCapability } from "@/lib/server/auth-context";
import { getProject } from "@/lib/server/project-queries";
import { InlineError } from "@/components/feedback/PageState";
import { ProjectSettingsForm } from "@/features/projects/presentation/ProjectSettingsForm";

export const dynamic = "force-dynamic";

export default async function ProjectSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const ctx = await requireSession();
  const canEdit = hasCapability(ctx, "project.edit");

  const projectResult = await getProject(ctx.token, resolvedParams.id);

  return (
    <div className="animate-fade-in">
      <h2 className="text-2xl font-bold">Project settings</h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Project identity, dates, reporting schedule, and status. Every change is audited.
      </p>
      {!projectResult.ok && <div className="mt-4"><InlineError title={projectResult.error.message} referenceId={projectResult.error.referenceId} /></div>}
      {projectResult.ok && !canEdit && (
        <div className="card mt-6 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
          You have read-only access to this project. Changes to project settings require the project editor permission.
        </div>
      )}
      {projectResult.ok && canEdit && (
        <div className="mt-4">
          <ProjectSettingsForm project={projectResult.value} />
        </div>
      )}
    </div>
  );
}
