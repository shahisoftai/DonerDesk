import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/server/auth-context";
import { loadReportingProfileAction } from "@/lib/actions/setup";
import { InlineError } from "@/components/feedback/PageState";
import { ReportingProfileForm } from "./ReportingProfileForm";

export const dynamic = "force-dynamic";

export default async function ProjectReportingProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireSession();
  const result = await loadReportingProfileAction(id);
  if (!result.ok) {
    return <InlineError title={result.error.message} referenceId={result.error.referenceId} />;
  }
  if (!result.value) notFound();

  return (
    <div className="animate-fade-in mx-auto max-w-2xl">
      <Link className="btn-secondary mb-4" href={`/projects/${id}/setup`}>← Back to setup</Link>
      <h2 className="text-xl font-semibold tracking-tight">Reporting profile</h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
        How DonorDesk writes your donor reports: language, tone, formatting rules, and word-count guidance.
      </p>
      <div className="mt-6">
        <ReportingProfileForm projectId={id} initialProfile={result.value.profile} />
      </div>
    </div>
  );
}
