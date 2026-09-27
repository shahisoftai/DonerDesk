import Link from "next/link";
import { requireSession } from "@/lib/server/auth-context";
import { loadProjectOverview } from "@/features/projects/application/project-overview-read-model";
import { InlineError, EmptyState } from "@/components/feedback/PageState";
import { Badge } from "@/components/data/Badge";
import { ReadinessGauge } from "@/components/data/ReadinessGauge";
import { ReadinessBreakdownList } from "@/features/projects/presentation/ReadinessBreakdownList";
import { PeriodSwitcher } from "@/features/projects/presentation/PeriodSwitcher";
import { projectStatusTone, severityTone } from "@/lib/shared/tone";
import { REPORT_TYPE_LABEL } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function ProjectDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ period?: string }>;
}) {
  const [resolvedParams, { period }] = await Promise.all([params, searchParams]);
  const ctx = await requireSession();
  const load = await loadProjectOverview(ctx.token, resolvedParams.id, period);

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
          <PeriodSwitcher periods={periods} value={activePeriodId ?? ""} />
        </section>
      )}

      {!hasPeriod && (
        <section className="mt-6">
          <div className="card">
            <h2 className="font-medium">Set up your reporting period</h2>
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
            <h2 className="font-medium">Report readiness</h2>
            <div className="mt-4"><ReadinessGauge value={readiness.overall} label={`${REPORT_TYPE_LABEL[periods.find((p) => p.id === activePeriodId)?.reportType ?? ""] ?? "Report"}`} /></div>
            {activePeriodId && <ReadinessBreakdownList readiness={readiness} projectId={project.id} periodId={activePeriodId} />}
            <Link className="mt-4 inline-block text-sm text-brand-600 hover:underline dark:text-brand-400" href={`/projects/${project.id}/reports/${activePeriodId ?? ""}`}>
              Open report workspace →
            </Link>
          </div>

          <div className="space-y-6">
            <div className="card">
              <h2 className="font-medium">Compliance gaps</h2>
              {openChecklist.length === 0 && <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">No open compliance items.</p>}
              {openChecklist.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {openChecklist.slice(0, 6).map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0 break-words leading-5">{c.title}</span>
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
          <h2 className="font-medium">Donor templates</h2>
          <Link className="mt-2 inline-block text-sm text-brand-600 hover:underline dark:text-brand-400" href={`/projects/${project.id}/templates`}>
            Manage templates →
          </Link>
        </div>
        <div className="card">
          <h2 className="font-medium">Logframe</h2>
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
      <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-1 bg-gradient-to-r from-brand-500 to-accent-400 bg-clip-text text-2xl font-semibold tracking-tight text-transparent">{value}</div>
    </div>
  );
}
