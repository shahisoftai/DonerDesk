import Link from "next/link";
import { requireSession } from "@/lib/server/auth-context";
import { loadDashboard, type DashboardWidget } from "@/features/dashboard/application/dashboard-read-model";
import type { DeadlineBand } from "@/features/dashboard/presentation/deadline-bands";
import { loadWorkItems } from "@/features/work-items/application/work-items-read-model";
import { workItemHref, workItemMeta, workItemTitle } from "@/features/work-items/presentation/work-items-view";
import type { WorkItem } from "@/features/work-items/domain/work-item";
import { InlineError, EmptyState } from "@/components/feedback/PageState";
import { Badge } from "@/components/data/Badge";
import { projectStatusTone } from "@/lib/shared/tone";

export const dynamic = "force-dynamic";

const BAND_LABEL: Record<DeadlineBand, string> = {
  overdue: "Overdue",
  today: "Due today",
  soon: "Due within 3 days",
  later: "On track",
};

export default async function Dashboard() {
  const ctx = await requireSession();
  const [snapshot, work] = await Promise.all([
    loadDashboard(ctx.token),
    loadWorkItems(ctx.token),
  ]);

  const projects = snapshot.projects.ok ? snapshot.projects.value ?? [] : [];
  const notifications = snapshot.notifications.ok ? snapshot.notifications.value ?? [] : [];
  const deadlines = snapshot.deadlineData.ok ? snapshot.deadlineData.value ?? [] : [];
  const pendingEvidence = snapshot.pendingEvidence.ok ? snapshot.pendingEvidence.value : null;

  const active = projects.filter((p) => p.status === "ACTIVE");
  const unread = notifications.filter((n) => !n.read);
  const dueSoon = deadlines.filter((d) => d.band === "overdue" || d.band === "today" || d.band === "soon");
  const workItems = work.ok ? work.items : [];
  const topWork = workItems.slice(0, 5);
  const evidenceWork = workItems.filter((item) => item.kind === "evidence");
  const complianceWork = workItems.filter((item) => item.kind === "checklist");
  const activityWork = workItems.filter((item) => item.kind === "activity");
  const readinessProjects = deadlines
    .filter((d) => d.readinessScore !== null)
    .sort((a, b) => (a.readinessScore ?? 101) - (b.readinessScore ?? 101))
    .slice(0, 6);
  const averageReadiness = readinessProjects.length > 0
    ? Math.round(readinessProjects.reduce((sum, d) => sum + (d.readinessScore ?? 0), 0) / readinessProjects.length)
    : null;

  return (
    <div className="animate-fade-in">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-brand-600 dark:text-brand-400">Operational home</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">What needs your attention</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Authoritative counts from your workspace. Missing data is shown as unavailable, never as zero.
          </p>
        </div>
        <Link className="btn-secondary" href="/my-work">Open My Work</Link>
      </header>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <CountCard
          label="Active projects"
          value={snapshot.projects.ok ? String(active.length) : null}
          href="/projects"
          hint={snapshot.projects.ok ? `${projects.length} total` : undefined}
          widget={snapshot.projects}
        />
        <CountCard
          label="Reports needing attention"
          value={snapshot.deadlineData.ok ? String(dueSoon.length) : null}
          href="/projects"
          hint="overdue, today, or within 3 days"
          widget={snapshot.deadlineData}
        />
        <CountCard
          label="Evidence pending review"
          value={pendingEvidence === null ? null : String(pendingEvidence)}
          href="/evidence"
          hint="awaiting verification"
          widget={snapshot.pendingEvidence}
        />
        <CountCard
          label="Unread notifications"
          value={snapshot.notifications.ok ? String(unread.length) : null}
          href="/notifications"
          hint={snapshot.notifications.ok ? `${notifications.length} total` : undefined}
          widget={snapshot.notifications}
        />
      </section>

      <section className="mt-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium">Deadline overview</h2>
          <Link href="/reports" className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400">Open reports →</Link>
        </div>
        {!snapshot.deadlineData.ok && (
          <div className="mt-3"><InlineError title={snapshot.deadlineData.error?.message ?? "Deadlines unavailable"} referenceId={snapshot.deadlineData.error?.referenceId} /></div>
        )}
        {snapshot.deadlineData.ok && deadlines.length === 0 && (
          <div className="mt-3"><EmptyState>No reporting deadlines yet.</EmptyState></div>
        )}
        {snapshot.deadlineData.ok && deadlines.length > 0 && (
          <div className="mt-3 grid gap-3 lg:grid-cols-4">
            {(["overdue", "today", "soon", "later"] as const).map((band) => (
              <div key={band} className="min-w-0 rounded-lg border border-slate-200/70 bg-white p-3 dark:border-white/10 dark:bg-white/[0.03]">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-medium text-slate-600 dark:text-slate-300">{BAND_LABEL[band]}</h3>
                  <Badge tone={bandTone(band)}>{deadlines.filter((d) => d.band === band).length}</Badge>
                </div>
                <div className="mt-3 space-y-2">
                  {deadlines.filter((d) => d.band === band).slice(0, 4).map((d) => (
                    <Link key={`${d.projectId}-${d.periodId}`} href={`/projects/${d.projectId}/reports/${d.periodId}`} className="block rounded-md border border-slate-200/70 px-3 py-2 text-sm transition hover:border-brand-400/40 dark:border-white/10 dark:hover:border-brand-400/30">
                      <div className="break-words text-sm font-medium leading-5">{d.projectTitle}</div>
                      <div className="mt-1 flex min-w-0 items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span>{new Date(d.deadline).toLocaleDateString()}</span>
                        <span className="shrink-0 tabular-nums">{d.readinessScore === null ? "readiness n/a" : `${d.readinessScore}% ready`}</span>
                      </div>
                    </Link>
                  ))}
                  {deadlines.filter((d) => d.band === band).length === 0 && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">None</p>
                  )}
                  {deadlines.filter((d) => d.band === band).length > 4 && (
                    <Link href={`/reports?band=${band}`} className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400">View more</Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="min-w-0">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-medium">My Work</h2>
            <Link href="/my-work" className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400">View all →</Link>
          </div>
          {!work.ok && (
            <div className="mt-3"><InlineError title={work.error?.message ?? "Could not load your work."} referenceId={work.error?.referenceId} /></div>
          )}
          {work.ok && topWork.length === 0 && (
            <div className="mt-3"><EmptyState>No urgent work items right now.</EmptyState></div>
          )}
          {work.ok && topWork.length > 0 && (
            <div className="mt-3 space-y-2">
              {topWork.map((item) => <WorkPreview key={`${item.kind}-${item.id}`} item={item} />)}
            </div>
          )}
        </div>

        <div className="min-w-0">
          <h2 className="text-sm font-medium">Readiness snapshot</h2>
          <div className="mt-3 card">
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Average readiness</div>
                <div className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{averageReadiness === null ? "—" : `${averageReadiness}%`}</div>
              </div>
              <Badge tone={averageReadiness === null ? "neutral" : readinessTone(averageReadiness)}>
                {averageReadiness === null ? "Unavailable" : averageReadiness >= 75 ? "Ready" : averageReadiness >= 40 ? "At risk" : "Blocked"}
              </Badge>
            </div>
            <div className="mt-4 space-y-3">
              {readinessProjects.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">No reporting readiness data yet.</p>}
              {readinessProjects.map((d) => (
                <Link key={`ready-${d.projectId}-${d.periodId}`} href={`/projects/${d.projectId}/reports/${d.periodId}`} className="block">
                  <div className="flex min-w-0 items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 break-words font-medium leading-5">{d.projectTitle}</span>
                    <span className="shrink-0 font-medium tabular-nums">{d.readinessScore}%</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                    <div className={`h-full rounded-full ${readinessBar(d.readinessScore ?? 0)}`} style={{ width: `${d.readinessScore}%` }} />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-3">
        <QueueCard title="Evidence review" count={evidenceWork.length} href="/evidence" items={evidenceWork} />
        <QueueCard title="Compliance blockers" count={complianceWork.length} href="/compliance" items={complianceWork} />
        <QueueCard title="Activity updates" count={activityWork.length} href="/my-work?type=activity" items={activityWork} />
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">Recent projects</h2>
            <Link href="/projects" className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400">View all →</Link>
          </div>
          {!snapshot.projects.ok && <div className="mt-3"><InlineError title={snapshot.projects.error?.message ?? "Projects unavailable"} referenceId={snapshot.projects.error?.referenceId} /></div>}
          {snapshot.projects.ok && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {projects.length === 0 && (
                <div className="card text-sm text-slate-600 dark:text-slate-300 sm:col-span-2">
                  No projects yet. <Link className="font-medium text-brand-600 hover:underline dark:text-brand-400" href="/projects/new">Create your first project</Link>.
                </div>
              )}
              {projects.slice(0, 6).map((p) => {
                const deadline = deadlines.find((d) => d.projectId === p.id);
                return (
                  <Link key={p.id} href={`/projects/${p.id}`} className="card min-w-0 transition hover:border-brand-400/40 dark:hover:border-brand-400/30">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="break-words text-sm font-medium leading-5">{p.title}</div>
                        <div className="mt-0.5 break-words text-xs leading-4 text-slate-500 dark:text-slate-400">{p.donorName} · {p.country}</div>
                      </div>
                      <Badge tone={projectStatusTone(p.status)} className="shrink-0">{p.status.replace(/_/g, " ")}</Badge>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span>{p.daysRemaining}d project time</span>
                      <span className="text-right tabular-nums">{deadline?.readinessScore === null || deadline?.readinessScore === undefined ? "readiness n/a" : `${deadline.readinessScore}% ready`}</span>
                      <span className="col-span-2 break-words">
                        {deadline ? `Next report ${new Date(deadline.deadline).toLocaleDateString()}` : "No report scheduled"}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <div className="min-w-0 grid gap-6">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium">Notifications</h2>
              <Link href="/notifications" className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400">Open inbox →</Link>
            </div>
            {!snapshot.notifications.ok && <div className="mt-3"><InlineError title={snapshot.notifications.error?.message ?? "Notifications unavailable"} referenceId={snapshot.notifications.error?.referenceId} /></div>}
            {snapshot.notifications.ok && (
              <ul className="mt-3 space-y-2">
                {notifications.length === 0 && <li className="text-sm text-slate-500 dark:text-slate-400">No notifications yet.</li>}
                {notifications.slice(0, 4).map((n) => (
                  <li key={n.id} className="rounded-lg border border-slate-200/60 bg-white px-4 py-3 dark:border-white/10 dark:bg-white/[0.03]">
                    <div className="flex items-center justify-between gap-3">
                      <span className="min-w-0 break-words text-sm font-medium leading-5">{n.title}</span>
                      <Badge tone={n.read ? "neutral" : "info"} className="shrink-0">{n.read ? "Read" : "New"}</Badge>
                    </div>
                    {n.message && <p className="mt-1 break-words text-xs leading-4 text-slate-500 dark:text-slate-400">{n.message}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h2 className="text-sm font-medium">Setup and storage</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Link href="/settings/setup" className="rounded-lg border border-slate-200/70 bg-white p-4 transition hover:border-brand-400/40 dark:border-white/10 dark:bg-white/[0.03]">
                <div className="text-sm font-medium">Workspace setup</div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Templates, organization profile, and defaults</div>
              </Link>
              <Link href="/evidence" className="rounded-lg border border-slate-200/70 bg-white p-4 transition hover:border-brand-400/40 dark:border-white/10 dark:bg-white/[0.03]">
                <div className="text-sm font-medium">Evidence storage</div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{pendingEvidence === null ? "Review count unavailable" : `${pendingEvidence} file${pendingEvidence === 1 ? "" : "s"} pending review`}</div>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function WorkPreview({ item }: { item: WorkItem }) {
  return (
    <Link href={workItemHref(item)} className="card flex items-center justify-between gap-3 transition hover:border-brand-400/40 dark:hover:border-brand-400/30">
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <Badge tone={kindTone(item.kind)} className="shrink-0">{item.kind}</Badge>
          <span className="min-w-0 break-words text-sm font-medium leading-5">{workItemTitle(item)}</span>
        </div>
        <div className="mt-1 break-words text-xs leading-4 text-slate-500 dark:text-slate-400">{workItemMeta(item)}</div>
      </div>
      {("daysUntilDeadline" in item && item.daysUntilDeadline !== null && item.daysUntilDeadline !== undefined) && (
        <span className={`shrink-0 self-start text-[11px] font-medium ${item.daysUntilDeadline < 0 ? "font-semibold text-danger-600 dark:text-danger-400" : item.daysUntilDeadline <= 3 ? "text-warning-600 dark:text-warning-400" : "text-slate-500 dark:text-slate-400"}`}>
          {item.daysUntilDeadline < 0 ? `${Math.abs(item.daysUntilDeadline)}d overdue` : `${item.daysUntilDeadline}d left`}
        </span>
      )}
    </Link>
  );
}

function QueueCard({ title, count, href, items }: { title: string; count: number; href: string; items: WorkItem[] }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium">{title}</h2>
        <Link href={href} className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400">{count}</Link>
      </div>
      <div className="mt-3 rounded-lg border border-slate-200/70 bg-white p-3 dark:border-white/10 dark:bg-white/[0.03]">
        <div className="space-y-2">
          {items.slice(0, 4).map((item) => (
            <Link key={`${title}-${item.kind}-${item.id}`} href={workItemHref(item)} className="block rounded-md border border-slate-200/70 px-3 py-2 transition hover:border-brand-400/40 dark:border-white/10 dark:hover:border-brand-400/30">
              <div className="break-words text-sm font-medium leading-5">{workItemTitle(item)}</div>
              <div className="mt-1 break-words text-xs leading-4 text-slate-500 dark:text-slate-400">{workItemMeta(item)}</div>
            </Link>
          ))}
          {items.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">No items waiting.</p>}
        </div>
      </div>
    </div>
  );
}

function kindTone(kind: WorkItem["kind"]): "info" | "success" | "warning" | "danger" | "neutral" | "ai" {
  switch (kind) {
    case "report": return "info";
    case "checklist": return "warning";
    case "evidence": return "ai";
    case "activity": return "success";
    case "notification": return "neutral";
  }
}

function readinessTone(value: number): "success" | "warning" | "danger" {
  if (value >= 75) return "success";
  if (value >= 40) return "warning";
  return "danger";
}

function readinessBar(value: number): string {
  if (value >= 75) return "bg-success-500";
  if (value >= 40) return "bg-warning-500";
  return "bg-danger-500";
}


function CountCard({
  label,
  value,
  hint,
  href,
  widget,
}: {
  label: string;
  value: string | null;
  hint?: string;
  href: string;
  widget: DashboardWidget<unknown>;
}) {
  const body = (
    <>
      <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{value === null ? "—" : value}</div>
      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint ?? (value === null ? "unavailable" : "")}</div>
    </>
  );
  if (!widget.ok) {
    return (
      <div className="card" role="alert">
        {body}
        <p className="mt-2 text-xs text-danger-600 dark:text-danger-400">Could not load</p>
      </div>
    );
  }
  return (
    <Link href={href} className="card transition hover:border-brand-400/40 dark:hover:border-brand-400/30">
      {body}
    </Link>
  );
}

function bandTone(band: DeadlineBand | null): "info" | "success" | "warning" | "danger" | "neutral" | "ai" {
  switch (band) {
    case "overdue": return "danger";
    case "today": return "warning";
    case "soon": return "warning";
    case "later": return "success";
    default: return "neutral";
  }
}
