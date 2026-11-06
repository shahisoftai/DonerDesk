import Link from "next/link";
import { Badge } from "@/components/data/Badge";
import { ReadinessGauge } from "@/components/data/ReadinessGauge";
import { ReadinessBreakdownList } from "@/features/projects/presentation/ReadinessBreakdownList";
import { readinessHeadline } from "@/features/projects/application/readiness-view";
import { deadlineUrgency } from "@/lib/shared/dates";
import type { ReportingData } from "@/features/projects/application/overview-view";
import { CardHead, OverviewSection } from "./overview-pieces";

/**
 * Where reporting stands: the periods as a pipeline (each one moves only forward), the readiness of
 * the period in view, what stands in the way, and the compliance items still open.
 */
export function ReportingSection({ reporting, projectId }: { reporting: ReportingData; projectId: string }) {
  const current = reporting.periods.find((p) => p.current) ?? reporting.periods[0];
  return (
    <OverviewSection kicker="Reporting" title="Where reporting stands" href={`/projects/${projectId}/reports`} linkLabel="All reports">
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="card">
          <CardHead title="Period pipeline" note="each period moves only forward" />
          <ol className="mt-3 flex flex-wrap gap-2">
            {reporting.periods.map((period) => (
              <li
                key={period.id}
                className={`min-w-[9.5rem] flex-1 rounded-lg border p-2.5 ${
                  period.current ? "border-brand-500/50 shadow-[0_0_0_3px_rgba(242,181,68,0.14)]" : "border-slate-200/70 dark:border-white/10"
                }`}
              >
                <p className="text-xs font-semibold">{period.title}</p>
                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">due {period.deadline.slice(0, 10)}</p>
                <div className="mt-1.5">
                  <Badge tone={statusTone(period.status)}>{statusLabel(period.status)}</Badge>
                </div>
                {period.current ? <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">{period.readiness}% ready</p> : null}
              </li>
            ))}
          </ol>

          {reporting.readiness && current ? (
            <>
              <hr className="my-4 border-t border-slate-200/70 dark:border-white/10" />
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <ReadinessGauge
                    value={reporting.readiness.overall}
                    label={readinessHeadline(reporting.readiness.overall, reporting.readiness.stage, (reporting.readiness.totalSections ?? 1) > 0)}
                  />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400">What stands in the way</h4>
                  {reporting.blockers.length === 0 ? (
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Nothing is blocking this report.</p>
                  ) : (
                    <ul className="mt-2 space-y-1.5">
                      {reporting.blockers.slice(0, 4).map((blocker) => (
                        <li key={blocker.label} className="text-sm">
                          <span className="font-medium">{blocker.label}</span>
                          {blocker.detail ? <span className="text-slate-500 dark:text-slate-400"> — {blocker.detail}</span> : null}
                        </li>
                      ))}
                    </ul>
                  )}
                  <Link className="mt-3 inline-block text-sm font-medium text-brand-600 hover:underline dark:text-brand-400" href={`/projects/${projectId}/reports/${current.id}`}>
                    Open the report workspace →
                  </Link>
                </div>
              </div>
              {current.id ? (
                <div className="mt-4">
                  <ReadinessBreakdownList readiness={reporting.readiness} projectId={projectId} periodId={current.id} />
                </div>
              ) : null}
            </>
          ) : null}
        </div>

        <div className="card">
          <CardHead
            title="Compliance"
            action={<Badge tone={reporting.compliance.length > 0 ? "warning" : "success"}>{reporting.compliance.length === 0 ? "Nothing open" : `${reporting.compliance.length} open`}</Badge>}
          />
          {reporting.compliance.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">No open compliance items.</p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-200/70 dark:divide-white/10">
              {reporting.compliance.slice(0, 5).map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0 break-words leading-5">{item.title}</span>
                  <Badge tone={severityTone(item.severity)}>{item.severity.toLowerCase()}</Badge>
                </li>
              ))}
            </ul>
          )}
          <Link className="mt-3 inline-block text-sm font-medium text-brand-600 hover:underline dark:text-brand-400" href={`/projects/${projectId}/compliance`}>
            Open compliance →
          </Link>
          {current ? (
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              Next deadline {current.deadline.slice(0, 10)} · {deadlineUrgency(current.daysUntilDeadline).label}
            </p>
          ) : null}
        </div>
      </div>
    </OverviewSection>
  );
}

function statusTone(status: string): "info" | "success" | "warning" | "danger" | "neutral" {
  switch (status) {
    case "SUBMITTED":
    case "CLOSED":
      return "success";
    case "APPROVED":
      return "info";
    case "UNDER_REVIEW":
    case "DRAFT_GENERATED":
      return "warning";
    case "NOT_STARTED":
    case "EVIDENCE_COLLECTION":
      return "neutral";
    default:
      return "neutral";
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case "NOT_STARTED": return "Not started";
    case "EVIDENCE_COLLECTION": return "Gathering evidence";
    case "DRAFT_GENERATED": return "Draft written";
    case "UNDER_REVIEW": return "In review";
    case "APPROVED": return "Approved";
    case "SUBMITTED": return "Submitted";
    case "CLOSED": return "Closed";
    default: return status.replace(/_/g, " ").toLowerCase();
  }
}

function severityTone(severity: string): "info" | "success" | "warning" | "danger" | "neutral" {
  switch (severity) {
    case "CRITICAL":
    case "HIGH": return "danger";
    case "MEDIUM": return "warning";
    case "LOW": return "neutral";
    default: return "neutral";
  }
}
