import { requireSession } from "@/lib/server/auth-context";
import { getSetupProposalAction } from "@/lib/actions/project-setup";
import { SetupWizard } from "@/features/project-setup/presentation/SetupWizard";

export const dynamic = "force-dynamic";

export default async function SetupReviewPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ s?: string }> }) {
  await requireSession();
  const { id } = await params;
  const { s } = await searchParams;
  const r = await getSetupProposalAction(id);
  if (!r.ok) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-100">{r.error.message || "This setup could not be opened."}</p>
        <p className="mt-3 text-sm"><a className="underline" href="/projects/new/document">Start a new setup</a></p>
      </div>
    );
  }
  return <SetupWizard view={r.value} recent={[]} asked={s ?? null} />;
}
