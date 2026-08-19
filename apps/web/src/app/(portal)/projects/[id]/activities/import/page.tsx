import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { ReportingPeriodsResponseSchema } from "@/lib/server/schemas";
import { InlineError } from "@/components/feedback/PageState";
import { ImportActivitiesForm } from "@/features/activities/presentation/ImportActivitiesForm";

export const dynamic = "force-dynamic";

export default async function ImportActivitiesPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const ctx = await requireSession();

  const periodsResult = await gatewayRequest(`/v1/projects/${resolvedParams.id}/reporting-periods`, ReportingPeriodsResponseSchema, ctx.token);

  if (!periodsResult.ok) {
    return <InlineError title={periodsResult.error.message} referenceId={periodsResult.error.referenceId} />;
  }

  const periods = periodsResult.value.items;
  if (periods.length === 0) {
    return (
      <div className="animate-fade-in">
        <h1 className="text-xl font-semibold tracking-tight">Import activities from Excel</h1>
        <div className="card mt-6 text-sm text-slate-600 dark:text-slate-300">
          <p>
            Imported activities must belong to a reporting period, but this project has no reporting periods yet.
          </p>
          <a className="btn-secondary mt-4 inline-flex" href={`/projects/${resolvedParams.id}/reports/new`}>
            Create a reporting period
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <ImportActivitiesForm
        projectId={resolvedParams.id}
        reportingPeriods={periods.map((p) => ({
          id: p.id,
          label: `${p.reportType} (${p.startDate.slice(0, 10)} → ${p.endDate.slice(0, 10)})`,
        }))}
      />
    </div>
  );
}
