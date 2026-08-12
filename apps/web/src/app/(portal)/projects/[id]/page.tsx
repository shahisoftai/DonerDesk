import Link from "next/link";
import { requireSession } from "@/lib/server/auth-context";
import { loadProjectOverview } from "@/features/projects/application/project-overview-read-model";
import { InlineError, EmptyState } from "@/components/feedback/PageState";
import { Badge } from "@/components/data/Badge";
import { ReadinessGauge } from "@/components/data/ReadinessGauge";
import { ProgressBar } from "@/components/data/ProgressBar";
import { projectStatusTone, severityTone } from "@/lib/shared/tone";
import { REPORT_TYPE_LABEL } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function ProjectDetail({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const ctx = await requireSession();
  const load = await loadProjectOverview(ctx.token, resolvedParams.id);

  if (!load.ok) {
    return <InlineError title={load.error?.message ?? "Project could not be loaded."} referenceId={load.error?.referenceId} />;
  }
  const overview = load.value;
  if (!overview) {
    return <InlineError title="Project could not be loaded." />;
  }
  const { project, periods, readiness, checklist, pendingEvidence, activityCount, activePeriodId } = overview;
  const openChecklist = checklist.filter((c) => c.status !== "RESOLVED" && c.status !== "ACCEPTED_RISK" && c.status !== "NOT_APPLICABLE");
  const hasPeriod = periods.length > 0;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-slate-600 dark:text-slate-400">
          {project.donorName} · {project.country} · {project.sector.replace(/_/g, " ")}
        </div>
        <div className="flex gap-2">
          <Badge tone={projectStatusTone(project.status)}>{project.status.replace(/_/g, " ")}</Badge>
          <Badge tone="neutral">{project.reportingFrequency.toLowerCase().replace("_", " ")}</Badge>
        </div>
      </div>

      {periods.length > 0 && (
        <section className="mt-4" aria-label="Reporting period">
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400" htmlFor="period-select">Reporting period</label>
          <select id="period-select" className="input mt-1 max-w-xs">
            {periods.map((p) => (
              <option key={p.id} value={p.id}>
                {REPORT_TYPE_LABEL[p.reportType] ?? p.reportType} — {p.status.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </section>
      )}

      {!hasPeriod && (
        <section className="mt-6">
          <div className="card">
            <h2 className="font-semibold">Set up your reporting period</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Create a reporting period to start collecting evidence and generating a report.
            </p>
            <Link className="btn mt-3" href={`/projects/${project.id}/reports/new`}>Create reporting period</Link>
          </div>
        </section>
      )}

      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Days remaining" value={String(project.daysRemaining)} />
        <Stat label="Pending evidence" value={pendingEvidence === 0 ? "0" : String(pendingEvidence)} />
        <Stat label="Activities" value={String(activityCount)} />
      </section>

      {readiness && (
        <section className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="card">
            <h2 className="font-semibold">Report readiness</h2>
            <div className="mt-4"><ReadinessGauge value={readiness.overall} label={`${REPORT_TYPE_LABEL[periods[0]?.reportType ?? ""] ?? "Report"}`} /></div>
            <dl className="mt-6 space-y-3">
              <BreakdownRow label="Sections approved" value={readiness.sectionsScore} />
              <BreakdownRow label="Indicators verified" value={readiness.indicatorsScore} />
              <BreakdownRow label="Evidence attached" value={readiness.evidenceScore} />
              <BreakdownRow label="Checklist resolved" value={readiness.checklistScore} />
              <BreakdownRow label="Approval" value={readiness.approvalScore} />
            </dl>
            <Link className="mt-4 inline-block text-sm text-brand-600 hover:underline dark:text-brand-400" href={`/projects/${project.id}/reports/${activePeriodId ?? ""}`}>
              Open report workspace →
            </Link>
          </div>

          <div className="space-y-6">
            <div className="card">
              <h2 className="font-semibold">Compliance gaps</h2>
              {openChecklist.length === 0 && <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">No open compliance items.</p>}
              {openChecklist.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {openChecklist.slice(0, 6).map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate">{c.title}</span>
                      <Badge tone={severityTone(c.severity)}>{c.severity.toLowerCase()}</Badge>
                    </li>
                  ))}
                </ul>
              )}
              <Link className="mt-3 inline-block text-sm text-brand-600 hover:underline dark:text-brand-400" href={`/projects/${project.id}/compliance`}>
                Open compliance →
              </Link>
            </div>
          </div>
        </section>
      )}

      {!readiness && hasPeriod && (
        <div className="mt-8"><EmptyState>Readiness for this reporting period is not available.</EmptyState></div>
      )}

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="font-semibold">Donor templates</h2>
          <Link className="mt-2 inline-block text-sm text-brand-600 hover:underline dark:text-brand-400" href={`/projects/${project.id}/templates`}>
            Manage templates →
          </Link>
        </div>
        <div className="card">
          <h2 className="font-semibold">Logframe</h2>
          <Link className="mt-2 inline-block text-sm text-brand-600 hover:underline dark:text-brand-400" href={`/projects/${project.id}/logframe`}>
            Manage logframe →
          </Link>
        </div>
      </section>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card">
      <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-1 bg-gradient-to-r from-brand-500 to-accent-400 bg-clip-text text-2xl font-extrabold text-transparent">{value}</div>
    </div>
  );
}

function BreakdownRow({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className="font-semibold">{value}%</span>
      </div>
      <div className="mt-1"><ProgressBar value={value} tone={value >= 75 ? "success" : value >= 40 ? "warning" : "danger"} /></div>
    </div>
  );
}
