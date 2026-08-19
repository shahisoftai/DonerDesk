import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/server/auth-context";
import { loadPeriodIndicatorsAction } from "@/lib/actions/indicators";
import { InlineError } from "@/components/feedback/PageState";
import { IndicatorEntryGrid } from "@/features/reporting/presentation/IndicatorEntryGrid";

export const dynamic = "force-dynamic";

export default async function IndicatorEntryPage({ params }: { params: Promise<{ id: string; periodId: string }> }) {
  const resolvedParams = await params;
  const ctx = await requireSession();
  const result = await loadPeriodIndicatorsAction(resolvedParams.periodId);

  if (!result.ok) {
    if (result.error.kind === "not_found") notFound();
    return (
      <div className="animate-fade-in">
        <header className="flex items-center justify-between">
          <h1 className="text-xl font-semibold tracking-tight">Indicator data entry</h1>
          <Link className="btn-secondary" href={`/projects/${resolvedParams.id}/reports/${resolvedParams.periodId}`}>
            Back
          </Link>
        </header>
        <div className="mt-6">
          <InlineError title={result.error.message} referenceId={result.error.referenceId} />
        </div>
      </div>
    );
  }

  const canEdit = ctx.capabilities.has("indicator.update");
  const canVerify = ctx.capabilities.has("indicator.verify");

  return (
    <div className="animate-fade-in">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-slate-500">Reporting period · {resolvedParams.periodId.slice(0, 8)}</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">Indicator data entry</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Enter this period&apos;s indicator values in the grid below. Rows come from the project logframe; save them as drafts,
            then submit and verify each row.
          </p>
        </div>
        <div className="flex gap-2">
          <Link className="btn-secondary" href={`/projects/${resolvedParams.id}/reports`}>
            All reporting periods
          </Link>
          <Link className="btn-secondary" href={`/projects/${resolvedParams.id}/reports/${resolvedParams.periodId}`}>
            Report workspace
          </Link>
        </div>
      </header>

      <IndicatorEntryGrid
        projectId={resolvedParams.id}
        periodId={resolvedParams.periodId}
        rows={result.value.indicators}
        canEdit={canEdit}
        canVerify={canVerify}
      />
    </div>
  );
}
