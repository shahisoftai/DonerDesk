import { notFound } from "next/navigation";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { ReportingPeriodsResponseSchema, EvidenceResponseSchema, LogframeResponseSchema } from "@/lib/server/schemas";
import { InlineError } from "@/components/feedback/PageState";
import { periodOptionLabel, recentFirst } from "@/lib/shared/option-labels";
import { NewActivityForm } from "@/features/activities/presentation/NewActivityForm";

export const dynamic = "force-dynamic";

export default async function NewActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const ctx = await requireSession();

  const [periodsResult, evidenceResult, logframeResult] = await Promise.all([
    gatewayRequest(`/v1/projects/${resolvedParams.id}/reporting-periods`, ReportingPeriodsResponseSchema, ctx.token),
    gatewayRequest(`/v1/evidence/search`, EvidenceResponseSchema, ctx.token, {
      method: "POST",
      body: { projectId: resolvedParams.id, pageSize: 100 },
    }),
    gatewayRequest(`/v1/projects/${resolvedParams.id}/logframe`, LogframeResponseSchema, ctx.token),
  ]);

  if (!periodsResult.ok) {
    return <InlineError title={periodsResult.error.message} referenceId={periodsResult.error.referenceId} />;
  }

  const periods = periodsResult.value.items;
  if (periods.length === 0) {
    return (
      <div className="animate-fade-in">
        <h1 className="text-xl font-semibold tracking-tight">New activity update</h1>
        <div className="card mt-6 text-sm text-slate-600 dark:text-slate-300">
          <p>
            An activity update must belong to a reporting period, but this project has no reporting periods yet.
          </p>
          <a className="btn-secondary mt-4 inline-flex" href={`/projects/${resolvedParams.id}/reports/new`}>
            Create a reporting period
          </a>
        </div>
      </div>
    );
  }

  const evidence = evidenceResult.ok ? evidenceResult.value.items : [];

  return (
    <div className="animate-fade-in">
      <h1 className="text-xl font-semibold tracking-tight">New activity update</h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Submitting an activity update sends it for review by your project team.
      </p>
      <NewActivityForm
        projectId={resolvedParams.id}
        reportingPeriods={recentFirst(periods, (p) => p.startDate).map((p) => ({ id: p.id, label: periodOptionLabel(p), reportType: p.reportType, startDate: p.startDate, endDate: p.endDate }))}
        evidenceOptions={evidence.map((e) => ({ id: e.id, label: e.title }))}
        logframeItems={logframeResult.ok ? logframeResult.value.items : []}
      />
    </div>
  );
}
