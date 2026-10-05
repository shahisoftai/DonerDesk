import Link from "next/link";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { ClosingPlanSchema } from "@/lib/server/schemas";
import { InlineError } from "@/components/feedback/PageState";
import { Badge } from "@/components/data/Badge";
import { InlineAlert } from "@/components/feedback/InlineAlert";
import { closingActionHref, closingStatusLabel, closingSummary } from "@/features/reporting/application/closing-report-view";
import { StartClosingReportButton } from "@/features/reporting/presentation/StartClosingReportButton";

export const dynamic = "force-dynamic";

const TONE: Record<string, "success" | "warning" | "neutral" | "danger"> = { DONE: "success", TODO: "warning", AFTER_START: "neutral", BLOCKED: "danger" };

/** The guided closing report: what is left, where to do it, and one button to start. */
export default async function ClosingReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireSession();
  const result = await gatewayRequest(`/v1/projects/${id}/closing-report/plan`, ClosingPlanSchema, ctx.token);
  if (!result.ok) return <InlineError title={result.error.message} referenceId={result.error.referenceId} />;
  const plan = result.value;
  const canCreate = ctx.capabilities.has("report.generate");

  return (
    <div className="animate-fade-in max-w-3xl">
      <h1 className="text-xl font-semibold tracking-tight">Closing report</h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        The final report covers the project&apos;s whole life: project-wide figures, finance, evidence and sign-offs. {closingSummary(plan.todoCount, plan.canStart, Boolean(plan.existingFinalId))}
      </p>

      {plan.blockedReason && !plan.existingFinalId && <InlineAlert tone="warning" title="Cannot be started yet" className="mt-4">{plan.blockedReason}</InlineAlert>}
      {plan.existingFinalId && (
        <InlineAlert tone="info" title="Already started" className="mt-4">
          <Link className="font-medium underline" href={`/projects/${id}/reports/${plan.existingFinalId}`}>Open the closing report</Link>
        </InlineAlert>
      )}

      <ol className="mt-6 space-y-3" aria-label="Steps to the closing report">
        {plan.steps.map((s, i) => (
          <li key={s.key} className="card flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium"><span className="mr-2 text-slate-400">{i + 1}.</span>{s.label}</p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{s.detail}</p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <Badge tone={TONE[s.status] ?? "neutral"}>{closingStatusLabel(s.status)}</Badge>
              {s.action && s.status !== "DONE" && s.status !== "BLOCKED" && (
                <Link className="btn-secondary text-sm" href={closingActionHref(s.action.kind, id, plan.existingFinalId)}>{s.action.label}</Link>
              )}
            </div>
          </li>
        ))}
      </ol>

      {plan.canStart && plan.suggestedPeriod && canCreate && (
        <section className="card mt-6" aria-label="Start">
          <p className="text-sm">
            The report will cover <span className="font-medium">{plan.suggestedPeriod.startDate}</span> to <span className="font-medium">{plan.suggestedPeriod.endDate}</span>, closing your reporting cadence.
          </p>
          <div className="mt-3"><StartClosingReportButton projectId={id} /></div>
        </section>
      )}
    </div>
  );
}
