import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import {
  ReadinessSchema,
  ChecklistResponseSchema,
  ReportDraftResponseSchema,
  ExportsResponseSchema,
  ExportPreflightSchema,
} from "@/lib/server/schemas";
import { InlineError } from "@/components/feedback/PageState";
import { ReportWorkspace } from "@/features/reporting/presentation/ReportWorkspace";

export const dynamic = "force-dynamic";

export default async function ReportWorkspacePage({ params }: { params: Promise<{ id: string; periodId: string }> }) {
  const resolvedParams = await params;
  const ctx = await requireSession();

  const [readinessResult, checklistResult, draftResult, exportsResult, preflightResult] = await Promise.all([
    gatewayRequest(`/v1/reporting-periods/${resolvedParams.periodId}/readiness`, ReadinessSchema, ctx.token),
    gatewayRequest(`/v1/reporting-periods/${resolvedParams.periodId}/checklist`, ChecklistResponseSchema, ctx.token),
    gatewayRequest(`/v1/reporting-periods/${resolvedParams.periodId}/draft`, ReportDraftResponseSchema, ctx.token),
    gatewayRequest(`/v1/projects/${resolvedParams.id}/exports`, ExportsResponseSchema, ctx.token),
    gatewayRequest(`/v1/reporting-periods/${resolvedParams.periodId}/export-preflight`, ExportPreflightSchema, ctx.token),
  ]);

  if (!readinessResult.ok) {
    if (readinessResult.error.kind === "not_found") notFound();
    return (
      <div className="animate-fade-in">
        <InlineError title={readinessResult.error.message} referenceId={readinessResult.error.referenceId} />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Report workspace</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">Reporting period {resolvedParams.periodId.slice(0, 8)}</p>
        </div>
        <Link className="btn-secondary" href={`/projects/${resolvedParams.id}/reports`}>Back</Link>
      </header>

      {!checklistResult.ok && <div className="mt-4"><InlineError title={checklistResult.error.message} /></div>}
      {!draftResult.ok && <div className="mt-4"><InlineError title={draftResult.error.message} /></div>}
      {!exportsResult.ok && <div className="mt-4"><InlineError title={exportsResult.error.message} /></div>}

      <ReportWorkspace
        projectId={resolvedParams.id}
        periodId={resolvedParams.periodId}
        draft={draftResult.ok ? draftResult.value.draft : null}
        sections={draftResult.ok ? draftResult.value.sections ?? [] : []}
        readiness={readinessResult.value}
        checklist={checklistResult.ok ? checklistResult.value.items : []}
        exports={exportsResult.ok ? exportsResult.value.items : []}
        unverifiedIndicatorCount={preflightResult.ok ? preflightResult.value.unverifiedIndicatorCount : 0}
        sensitiveEvidenceCount={preflightResult.ok ? preflightResult.value.sensitiveCount : 0}
        capabilities={Array.from(ctx.capabilities)}
      />
    </div>
  );
}
