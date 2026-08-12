import Link from "next/link";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { ReportingPeriodsResponseSchema } from "@/lib/server/schemas";
import { REPORT_TYPE_LABEL, REPORT_STATUS_LABEL } from "@/lib/labels";
import { InlineError } from "@/components/feedback/PageState";
import { Badge } from "@/components/data/Badge";
import { reportStatusTone } from "@/lib/shared/tone";
import { formatDate, deadlineUrgency } from "@/lib/shared/dates";

export const dynamic = "force-dynamic";

const STATUS_ORDER = ["NOT_STARTED", "IN_PROGRESS", "EVIDENCE_COLLECTION", "DRAFT_GENERATED", "UNDER_REVIEW", "APPROVED", "SUBMITTED", "CLOSED"];

export default async function ReportsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const ctx = await requireSession();
  const result = await gatewayRequest(
    `/v1/projects/${resolvedParams.id}/reporting-periods`,
    ReportingPeriodsResponseSchema,
    ctx.token,
  );
  if (!result.ok) {
    return (
      <div className="animate-fade-in">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Reports</h1>
          <Link className="btn" href={`/projects/${resolvedParams.id}/reports/new`}>Create reporting period</Link>
        </header>
        <div className="mt-6"><InlineError title={result.error.message} referenceId={result.error.referenceId} /></div>
      </div>
    );
  }
  const items = result.value.items;

  const groups = STATUS_ORDER.map((status) => ({
    status,
    items: items.filter((p) => p.status === status),
  })).filter((g) => g.items.length > 0);
  const hasItems = items.length > 0;

  return (
    <div className="animate-fade-in">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Reports</h1>
        <Link className="btn" href={`/projects/${resolvedParams.id}/reports/new`}>Create reporting period</Link>
      </header>

      {!hasItems ? (
        <div className="card mt-6 text-sm text-slate-600 dark:text-slate-300">
          No reporting periods yet. Create one to start generating drafts and running compliance checks.
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {groups.map((group) => (
            <section key={group.status} aria-label={REPORT_STATUS_LABEL[group.status] ?? group.status}>
              <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                {REPORT_STATUS_LABEL[group.status] ?? group.status.replace(/_/g, " ")}
                <span className="ml-2 font-normal text-slate-400">({group.items.length})</span>
              </h2>
              <div className="mt-2 space-y-2">
                {group.items.map((p) => (
                  <div key={p.id} className="card transition hover:border-brand-400/40 dark:hover:border-brand-400/30">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold">{REPORT_TYPE_LABEL[p.reportType] ?? p.reportType}</div>
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
                      {!p.donorTemplateId && (
                        <Link href={`/projects/${resolvedParams.id}/templates`} className="btn-secondary py-1 text-xs">
                          Attach template
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
