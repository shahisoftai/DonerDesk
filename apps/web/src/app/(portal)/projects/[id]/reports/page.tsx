import Link from "next/link";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { ReportingPeriodsResponseSchema, EnsureAutoPeriodResponseSchema, PeriodsPlanSchema } from "@/lib/server/schemas";
import { CreateAllPeriodsPanel } from "@/features/reporting/presentation/CreateAllPeriodsPanel";
import { reportHeading, REPORT_STATUS_LABEL } from "@/lib/labels";
import { InlineError } from "@/components/feedback/PageState";
import { Badge } from "@/components/data/Badge";
import { reportStatusTone } from "@/lib/shared/tone";
import { formatDate, deadlineUrgency } from "@/lib/shared/dates";
import { checkCancelPeriod, checkConvertToFinal } from "@donordesk/domain/contexts/reporting/period-lifecycle.js";
import { PeriodLifecycleActions, type PeriodLifecycleOffer } from "@/features/reporting/presentation/PeriodLifecycleActions";

export const dynamic = "force-dynamic";

const STATUS_ORDER = ["NOT_STARTED", "IN_PROGRESS", "EVIDENCE_COLLECTION", "DRAFT_GENERATED", "UNDER_REVIEW", "APPROVED", "SUBMITTED", "CLOSED"];

export default async function ReportsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const ctx = await requireSession();
  // Best-effort: creates the next due period when the reporting profile has
  // auto-creation on. Never blocks the page — a failure here just means one
  // fewer period than expected, not a broken Reports page.
  await gatewayRequest(`/v1/projects/${resolvedParams.id}/reporting-periods/ensure-auto`, EnsureAutoPeriodResponseSchema, ctx.token, { method: "POST", body: {} });
  const result = await gatewayRequest(
    `/v1/projects/${resolvedParams.id}/reporting-periods`,
    ReportingPeriodsResponseSchema,
    ctx.token,
  );
  const planResult = await gatewayRequest(`/v1/projects/${resolvedParams.id}/periods-plan`, PeriodsPlanSchema, ctx.token);
  if (!result.ok) {
    return (
      <div className="animate-fade-in">
        <header className="flex items-center justify-between">
          <h1 className="text-xl font-semibold tracking-tight">Reports</h1>
          <div className="flex gap-2">
          <Link className="btn-secondary" href={`/projects/${resolvedParams.id}/reports/closing`}>Closing report</Link>
          <Link className="btn" href={`/projects/${resolvedParams.id}/reports/new`}>Create reporting period</Link>
        </div>
        </header>
        <div className="mt-6"><InlineError title={result.error.message} referenceId={result.error.referenceId} /></div>
      </div>
    );
  }
  const allItems = result.value.items;
  const items = allItems.filter((p) => !p.cancelled);
  const cancelledItems = allItems.filter((p) => p.cancelled);
  const canManage = ctx.capabilities.has("project.edit");
  // The offers come from the rules the server enforces; the report's own status stands in for its draft statuses.
  const facts = items.map((p) => ({ id: p.id, reportType: p.reportType, start: new Date(p.startDate), end: new Date(p.endDate) }));
  const offersFor = (p: (typeof items)[number]): PeriodLifecycleOffer[] => {
    if (!canManage) return [];
    const offers: PeriodLifecycleOffer[] = [];
    if (checkCancelPeriod({ cancelled: false, draftStatuses: [p.status] }).ok) offers.push("cancel");
    const self = facts.find((f) => f.id === p.id);
    if (self && checkConvertToFinal({ period: self, cancelled: false, others: facts.filter((f) => f.id !== p.id), draftStatuses: [p.status] }).ok) offers.push("convert");
    return offers;
  };

  const groups = STATUS_ORDER.map((status) => ({
    status,
    items: items.filter((p) => p.status === status),
  })).filter((g) => g.items.length > 0);
  const hasItems = items.length > 0;

  return (
    <div className="animate-fade-in" data-tour-id="reporting-period-list">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Reports</h1>
        <Link className="btn" href={`/projects/${resolvedParams.id}/reports/new`}>Create reporting period</Link>
      </header>

      {planResult.ok && ctx.capabilities.has("reporting.edit") && (
        <CreateAllPeriodsPanel projectId={resolvedParams.id} plan={planResult.value.plan} note={planResult.value.note} />
      )}

      {!hasItems ? (
        <div className="card mt-6 text-sm text-slate-600 dark:text-slate-300">
          No reporting periods yet. Create one to start generating drafts and running compliance checks.
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {groups.map((group) => (
            <section key={group.status} aria-label={REPORT_STATUS_LABEL[group.status] ?? group.status}>
              <h2 className="text-sm font-medium text-slate-600 dark:text-slate-300">
                {REPORT_STATUS_LABEL[group.status] ?? group.status.replace(/_/g, " ")}
                <span className="ml-2 font-normal text-slate-400">({group.items.length})</span>
              </h2>
              <div className="mt-2 space-y-2">
                {group.items.map((p) => (
                  <div key={p.id} className="card transition hover:border-brand-400/40 dark:hover:border-brand-400/30">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="font-medium">{reportHeading(p.reportType, p.scope)}</div>
                        <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                          Period {formatDate(p.startDate)} – {formatDate(p.endDate)} · Deadline {formatDate(p.deadline)}
                          {p.internalReviewDeadline && ` · Internal ${formatDate(p.internalReviewDeadline)}`}
                        </div>
                        {(() => {
                          const urgency = deadlineUrgency(p.daysUntilDeadline);
                          return (
                            <span className={`mt-1 inline-block text-xs font-medium ${urgency.tone === "danger" ? "text-danger-600 dark:text-danger-400" : urgency.tone === "warning" ? "text-warning-600 dark:text-warning-400" : "text-slate-500 dark:text-slate-400"}`}>
                              {urgency.label}
                            </span>
                          );
                        })()}
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <div className="text-right">
                          <div className="text-xs text-slate-500 dark:text-slate-400">Readiness</div>
                          <div className={`font-semibold ${p.readinessScore >= 75 ? "text-success-600 dark:text-success-400" : p.readinessScore >= 40 ? "text-warning-600 dark:text-warning-400" : "text-danger-600 dark:text-danger-400"}`}>
                            {p.readinessScore}%
                          </div>
                        </div>
                        <Badge tone={reportStatusTone(p.status)}>{REPORT_STATUS_LABEL[p.status] ?? p.status.replace(/_/g, " ")}</Badge>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link href={`/projects/${resolvedParams.id}/reports/${p.id}`} className="btn-secondary py-1 text-xs">
                        Open workspace
                      </Link>
                      <Link href={`/projects/${resolvedParams.id}/reports/${p.id}/indicators`} className="btn-secondary py-1 text-xs">
                        Enter indicator data
                      </Link>
                      {!p.donorTemplateId && (
                        <Link href={`/projects/${resolvedParams.id}/templates`} className="btn-secondary py-1 text-xs">
                          Attach template
                        </Link>
                      )}
                    </div>
                    <PeriodLifecycleActions periodId={p.id} offers={offersFor(p)} />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {cancelledItems.length > 0 && (
        <section className="mt-8" aria-label="Cancelled periods">
          <h2 className="text-sm font-medium text-slate-600 dark:text-slate-300">
            Cancelled periods <span className="ml-1 font-normal text-slate-400">({cancelledItems.length})</span>
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">They no longer count in the calendar or the closing report. Their data is kept.</p>
          <div className="mt-2 space-y-2">
            {cancelledItems.map((p) => (
              <div key={p.id} className="card opacity-80">
                <div className="font-medium">{reportHeading(p.reportType, p.scope)}</div>
                <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Period {formatDate(p.startDate)} – {formatDate(p.endDate)}
                  {p.cancelReason ? ` · ${p.cancelReason}` : ""}
                </div>
                <PeriodLifecycleActions periodId={p.id} offers={canManage ? ["restore"] : []} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
