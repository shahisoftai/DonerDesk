import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import {
  ReportingPeriodsResponseSchema,
  ChecklistResponseSchema,
  ReadinessSchema,
} from "@/lib/server/schemas";
import { REPORT_TYPE_LABEL } from "@/lib/labels";
import { InlineError } from "@/components/feedback/PageState";
import { CompliancePanel } from "@/features/compliance/presentation/CompliancePanel";

export const dynamic = "force-dynamic";

export default async function CompliancePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedParams = await params;
  const raw = await searchParams;
  const requestedPeriod = typeof raw.period === "string" ? raw.period : undefined;
  const ctx = await requireSession();

  const periodsResult = await gatewayRequest(
    `/v1/projects/${resolvedParams.id}/reporting-periods`,
    ReportingPeriodsResponseSchema,
    ctx.token,
  );
  if (!periodsResult.ok) {
    return <InlineError title={periodsResult.error.message} referenceId={periodsResult.error.referenceId} />;
  }
  const periods = periodsResult.value.items;
  if (periods.length === 0) {
    return (
      <div className="animate-fade-in">
        <h1 className="text-xl font-semibold tracking-tight">Compliance</h1>
        <div className="card mt-6 text-sm text-slate-600 dark:text-slate-300">
          Compliance checklist items are shown per reporting period. Create a reporting period to get started.
        </div>
      </div>
    );
  }

  const periodId = periods.some((p) => p.id === requestedPeriod)
    ? (requestedPeriod as string)
    : periods[0]!.id;

  const [checklistResult, readinessResult] = await Promise.all([
    gatewayRequest(`/v1/reporting-periods/${periodId}/checklist`, ChecklistResponseSchema, ctx.token),
    gatewayRequest(`/v1/reporting-periods/${periodId}/readiness`, ReadinessSchema, ctx.token),
  ]);

  return (
    <div className="animate-fade-in">
      <h1 className="text-xl font-semibold tracking-tight">Compliance</h1>
      {!checklistResult.ok && <div className="mt-4"><InlineError title={checklistResult.error.message} /></div>}
      {!readinessResult.ok && <div className="mt-4"><InlineError title={readinessResult.error.message} /></div>}
      <CompliancePanel
        projectId={resolvedParams.id}
        periods={periods.map((p) => ({ id: p.id, label: REPORT_TYPE_LABEL[p.reportType] ?? p.reportType }))}
        periodId={periodId}
        checklist={checklistResult.ok ? checklistResult.value.items : []}
        readiness={readinessResult.ok ? readinessResult.value : { overall: 0, sectionsScore: 0, indicatorsScore: 0, evidenceScore: 0, checklistScore: 0, approvalScore: 0 }}
        capabilities={Array.from(ctx.capabilities)}
      />
    </div>
  );
}
