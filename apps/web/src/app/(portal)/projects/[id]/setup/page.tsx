import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/server/auth-context";
import { loadProjectSetupAction } from "@/lib/actions/setup";
import { InlineError } from "@/components/feedback/PageState";
import { Badge } from "@/components/data/Badge";
import { SetupChecklistClient } from "./SetupChecklistClient";
import { loadProjectOverviewV2 } from "@/features/projects/application/overview-read-model";
import { checklistOf } from "@/features/projects/application/project-checklist";
import { GuidedChecklist } from "@/features/projects/presentation/GuidedChecklist";
import { decodeSessionPayload } from "@/lib/shared/jwt-session";

export const dynamic = "force-dynamic";

export default async function ProjectSetupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireSession();
  const result = await loadProjectSetupAction(id);
  if (!result.ok) {
    return <InlineError title={result.error.message} referenceId={result.error.referenceId} />;
  }
  if (!result.value?.setup) notFound();
  const setup = result.value.setup;
  const overview = await loadProjectOverviewV2(ctx.token, id, { role: ctx.role, capabilities: ctx.capabilities, today: new Date().toISOString().slice(0, 10), meId: decodeSessionPayload(ctx.token)?.sub ?? "" });
  const guided = overview.ok && overview.value ? checklistOf(overview.value, ctx.capabilities) : null;

  return (
    <div className="animate-fade-in" data-tour-id="project-setup-checklist">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-slate-500">Setup checklist</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">Finish setting up your project</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Do these when you are ready. Nothing here stops you from recording data or planning work, except the items under "Before reporting".
          </p>
        </div>
        <Link className="btn-secondary" href={`/projects/${id}`}>View project</Link>
      </header>

      {guided ? <div className="mt-6"><GuidedChecklist checklist={guided} projectId={id} /></div> : null}

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        <h3 className="section-title lg:col-span-3">Before reporting</h3>
        <div className="lg:col-span-2">
          <SetupChecklistClient
            projectId={id}
            initialReadiness={setup.readiness}
            initialSnapshot={setup.snapshot}
            initiallyAcknowledged={setup.acknowledged}
            canManage={ctx.capabilities.has("project.setup") || ctx.capabilities.has("project.edit")}
          />
        </div>
        <aside className="space-y-4">
          <section className="card">
            <h3 className="font-medium">Workspace</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              {setup.snapshot.workspace.provisionStatus === "READY"
                ? "Your project folder tree is ready."
                : setup.snapshot.workspace.provisionStatus === "NOT_REQUIRED"
                  ? "Workspace folders are not required for your storage provider."
                  : setup.snapshot.workspace.provisionStatus === "FAILED"
                    ? "Workspace provisioning failed."
                    : "Workspace provisioning is pending."}
            </p>
            {setup.snapshot.workspace.provisionError && (
              <p className="mt-2 text-xs text-warning-700 dark:text-warning-400">{setup.snapshot.workspace.provisionError}</p>
            )}
          </section>
          <section className="card">
            <h3 className="font-medium">Indicator data entry</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Indicator values are recorded against reporting periods. You can define indicators now, but you&apos;ll enter their
              values once a reporting period is open.
            </p>
            <p className="mt-2">
              <Link className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400" href={`/projects/${id}/periods`}>
                Open reporting periods to enter indicator data
              </Link>
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
