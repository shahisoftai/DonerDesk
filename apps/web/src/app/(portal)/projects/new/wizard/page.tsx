import { redirect } from "next/navigation";
import { requireSession } from "@/lib/server/auth-context";
import { getDraftAction, startDraftAction } from "@/lib/actions/project-setup-draft";
import { listSetupProposalsAction } from "@/lib/actions/project-setup";
import { latestOpenBlankDraft } from "@/features/project-setup/pcw/domain/drafts";
import { PcwShell } from "@/features/project-setup/pcw/presentation/PcwShell";

export const dynamic = "force-dynamic";

/** The Project Creation Wizard (Phase 38). Opened with a draft id; with none it resumes the last open draft, else starts a new empty one. */
export default async function WizardPage({ searchParams }: { searchParams: Promise<{ id?: string; new?: string }> }) {
  await requireSession();
  const { id, new: startNew } = await searchParams;
  if (!id) {
    // Opening the wizard again carries on with the last open draft; `?new=1` starts a fresh one.
    if (!startNew) {
      const listed = await listSetupProposalsAction();
      const open = listed.ok ? latestOpenBlankDraft(listed.value.proposals) : null;
      if (open) redirect(`/projects/new/wizard?id=${encodeURIComponent(open.id)}`);
    }
    const started = await startDraftAction({});
    if (started.ok) redirect(`/projects/new/wizard?id=${encodeURIComponent(started.value.proposalId)}`);
    return <p role="alert" className="mx-auto max-w-xl p-6 text-sm">{started.error.message}</p>;
  }
  const view = await getDraftAction(id);
  if (!view.ok) return <p role="alert" className="mx-auto max-w-xl p-6 text-sm">{view.error.message}</p>;
  return <PcwShell key={id} id={id} initial={view.value} />;
}
